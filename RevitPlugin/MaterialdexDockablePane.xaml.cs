using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;

namespace Materialdex
{
    /// <summary>
    /// Dockable pane that hosts the Materialdex web application via WebView2.
    /// Enables communication between Revit and the web interface.
    /// </summary>
    public partial class MaterialdexDockablePane : UserControl, IDockablePaneProvider, IDisposable
    {
        private const string DEFAULT_URL = "http://localhost:3000";
        private const int RETRY_INTERVAL_SECONDS = 5; // Check connectivity every 5 seconds
        private bool _isInitialized = false;
        private string _webAppUrl = DEFAULT_URL;
        private UIControlledApplication? _uiApplication;
        private List<MaterialExtractor.ExtractedMaterial>? _cachedMaterials = null;
        private Document? _lastDocument = null;
        private DispatcherTimer? _retryTimer = null;
        private bool _isRetrying = false;
        private static readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };

        public MaterialdexDockablePane()
        {
            InitializeComponent();
            InitializeWebViewAsync();
        }

        public void SetUIControlledApplication(UIControlledApplication uiApplication)
        {
            _uiApplication = uiApplication;
            // Note: UIThemeManager.ThemeChanged event is not available in Revit 2026 API
            // Theme will be sent on page load and when requested via requestTheme()
        }

        /// <summary>
        /// Initializes WebView2 and navigates to the Materialdex app.
        /// </summary>
        private async void InitializeWebViewAsync()
        {
            try
            {
                UpdateStatus("Initializing WebView2...");

                // Set up WebView2 environment
                var env = await CoreWebView2Environment.CreateAsync(
                    null,
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Materialdex", "WebView2")
                );

                await WebView.EnsureCoreWebView2Async(env);

                // Configure WebView2 settings
                WebView.CoreWebView2.Settings.IsScriptEnabled = true;
                WebView.CoreWebView2.Settings.IsWebMessageEnabled = true;
                WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                WebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                WebView.CoreWebView2.Settings.AreDevToolsEnabled = true; // Enable for debugging

                // Handle navigation events
                WebView.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
                WebView.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;
                WebView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

                // Inject JavaScript bridge for communication
                await InjectJavaScriptBridge();

                // Navigate to the web app
                LoadWebApp();

                _isInitialized = true;
            }
            catch (Exception ex)
            {
                UpdateStatus($"Error: {ex.Message}");
                ShowFallbackContent(ex.Message);
            }
        }

        /// <summary>
        /// Loads the Materialdex web application.
        /// </summary>
        private void LoadWebApp()
        {
            try
            {
                UpdateStatus($"Loading {_webAppUrl}...");
                WebView.CoreWebView2.Navigate(_webAppUrl);
            }
            catch (Exception ex)
            {
                UpdateStatus($"Navigation error: {ex.Message}");
            }
        }

        /// <summary>
        /// Injects a JavaScript bridge to enable Revit-to-web communication.
        /// </summary>
        private async Task InjectJavaScriptBridge()
        {
            string script = @"
                window.revitBridge = {
                    isRevitPlugin: true,
                    sendToRevit: function(data) {
                        window.chrome.webview.postMessage(JSON.stringify(data));
                    },
                    receiveMaterials: function(materials) {
                        if (window.onRevitMaterials) {
                            window.onRevitMaterials(materials);
                        } else {
                            console.log('Revit materials received:', materials);
                            // Store for later use
                            window.revitMaterialsQueue = window.revitMaterialsQueue || [];
                            window.revitMaterialsQueue.push(materials);
                        }
                    },
                    receiveTheme: function(theme) {
                        console.log('Revit bridge: receiveTheme called with', theme);
                        if (window.onRevitTheme) {
                            console.log('Revit bridge: Calling onRevitTheme handler');
                            window.onRevitTheme(theme);
                        } else {
                            console.log('Revit bridge: No handler, queuing theme', theme);
                            // Store for later use
                            window.revitThemeQueue = window.revitThemeQueue || [];
                            window.revitThemeQueue.push(theme);
                        }
                    },
                    requestTheme: function() {
                        console.log('Revit bridge: Theme requested from web - sending message to Revit');
                        // Send message to Revit to request theme
                        window.chrome.webview.postMessage(JSON.stringify({ type: 'requestTheme' }));
                    },
                    requestMaterials: function(skip, take) {
                        console.log('Revit bridge: Materials requested from web - sending message to Revit');
                        // Send message to Revit to request materials
                        window.chrome.webview.postMessage(JSON.stringify({ type: 'requestMaterials', skip: skip, take: take }));
                    },
                    receiveProjectInfo: function(info) {
                        if (window.onRevitProjectInfo) {
                            window.onRevitProjectInfo(info);
                        } else {
                            console.log('Revit bridge: receiveProjectInfo called, no handler');
                            // Store for later use
                            window.revitProjectInfoQueue = window.revitProjectInfoQueue || [];
                            window.revitProjectInfoQueue.push(info);
                        }
                    },
                    requestProjectInfo: function() {
                        console.log('Revit bridge: Project info requested from web - sending message to Revit');
                        // Send message to Revit to request project info
                        window.chrome.webview.postMessage(JSON.stringify({ type: 'requestProjectInfo' }));
                    },
                    extractMaterials: function() {
                        console.log('Revit bridge: Extract materials requested from web - sending message to Revit');
                        // Send message to Revit to extract materials from active document
                        window.chrome.webview.postMessage(JSON.stringify({ type: 'extractMaterials' }));
                    }
                };
                window.revitThemeQueue = window.revitThemeQueue || [];
                window.revitProjectInfoQueue = window.revitProjectInfoQueue || [];
                console.log('Revit bridge initialized');
            ";

            await WebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        /// <summary>
        /// Sends extracted materials from Revit to the web application.
        /// Sends all materials at once (no pagination).
        /// </summary>
        public void SendMaterialsToWebView(List<MaterialExtractor.ExtractedMaterial> materials)
        {
            if (!_isInitialized || WebView.CoreWebView2 == null)
            {
                UpdateStatus("WebView not ready yet");
                return;
            }

            try
            {
                // Cache all materials
                _cachedMaterials = materials;
                
                // Send all materials at once (no pagination)
                string json = JsonConvert.SerializeObject(new
                {
                    materials = materials,
                    total = materials.Count,
                    skip = 0,
                    hasMore = false
                });
                string script = $"window.revitBridge.receiveMaterials({json});";
                WebView.CoreWebView2.ExecuteScriptAsync(script);
                UpdateStatus($"Sent {materials.Count} materials to Materialdex");
            }
            catch (Exception ex)
            {
                UpdateStatus($"Error sending materials: {ex.Message}");
            }
        }

        /// <summary>
        /// Sends paginated materials to the web application.
        /// </summary>
        private void SendPaginatedMaterials(int skip, int take)
        {
            if (!_isInitialized || WebView.CoreWebView2 == null)
            {
                UpdateStatus("WebView not ready yet");
                return;
            }

            if (_cachedMaterials == null || _cachedMaterials.Count == 0)
            {
                UpdateStatus("No materials cached. Please extract materials first.");
                return;
            }

            try
            {
                var batch = MaterialExtractor.GetPaginatedMaterials(_cachedMaterials, skip, take);
                string json = JsonConvert.SerializeObject(new
                {
                    materials = batch,
                    total = _cachedMaterials.Count,
                    skip = skip,
                    hasMore = skip + take < _cachedMaterials.Count
                });
                string script = $"window.revitBridge.receiveMaterials({json});";
                WebView.CoreWebView2.ExecuteScriptAsync(script);
                UpdateStatus($"Sent materials {skip + 1}-{skip + batch.Count} of {_cachedMaterials.Count}");
            }
            catch (Exception ex)
            {
                UpdateStatus($"Error sending paginated materials: {ex.Message}");
            }
        }

        /// <summary>
        /// Extracts materials from the current document and caches them.
        /// Uses the cached document reference or tries to get it from App.
        /// </summary>
        private void ExtractAndCacheMaterials()
        {
            try
            {
                Document? doc = _lastDocument;
                
                // If no cached document, try to extract from active document
                if (doc == null)
                {
                    // Try to extract from active document via App
                    App.ExtractMaterialsFromActiveDocument();
                    return;
                }

                // Extract if not cached
                if (_cachedMaterials == null)
                {
                    _cachedMaterials = MaterialExtractor.ExtractMaterials(doc);
                    UpdateStatus($"Extracted {_cachedMaterials.Count} materials from model");
                }
            }
            catch (Exception ex)
            {
                UpdateStatus($"Error extracting materials: {ex.Message}");
            }
        }

        /// <summary>
        /// Sets the document reference and extracts materials.
        /// Called from ExtractMaterialsCommand.
        /// </summary>
        public void SetDocumentAndExtract(Document doc)
        {
            _lastDocument = doc;
            // Materials will be extracted and cached in SendMaterialsToWebView
            // Also send project info when document is set
            SendProjectInfoToWebView();
        }

        /// <summary>
        /// Extracts project information from the Revit document and sends it to the web application.
        /// </summary>
        private void SendProjectInfoToWebView()
        {
            if (!_isInitialized || WebView.CoreWebView2 == null)
            {
                return;
            }

            Document? doc = _lastDocument;
            if (doc == null)
            {
                return;
            }

            try
            {
                // Get project information from Revit document
                string projectName = doc.ProjectInformation?.Name ?? doc.Title ?? "Unnamed Project";
                
                // Get unique project identifier - use document path if available, otherwise use document GUID
                string projectId = "";
                if (!string.IsNullOrEmpty(doc.PathName))
                {
                    // Use full path as unique identifier
                    projectId = doc.PathName;
                }
                else if (doc.IsWorkshared)
                {
                    // For workshared files, use the central model path
                    ModelPath centralPath = doc.GetWorksharingCentralModelPath();
                    if (centralPath != null)
                    {
                        projectId = ModelPathUtils.ConvertModelPathToUserVisiblePath(centralPath);
                    }
                }
                
                // Fallback to document GUID if no path available
                if (string.IsNullOrEmpty(projectId))
                {
                    projectId = doc.ProjectInformation?.UniqueId ?? doc.GetHashCode().ToString();
                }
                
                // Try to get address/location from ProjectInformation
                string address = "";
                string zip = "";
                
                if (doc.ProjectInformation != null)
                {
                    // Get address from ProjectInformation parameters
                    Parameter addressParam = doc.ProjectInformation.get_Parameter(BuiltInParameter.PROJECT_ADDRESS);
                    if (addressParam != null && !string.IsNullOrEmpty(addressParam.AsString()))
                    {
                        address = addressParam.AsString();
                        
                        // Try to extract ZIP code from address (look for 5-digit pattern)
                        System.Text.RegularExpressions.Regex zipRegex = new System.Text.RegularExpressions.Regex(@"\b\d{5}(-\d{4})?\b");
                        System.Text.RegularExpressions.Match zipMatch = zipRegex.Match(address);
                        if (zipMatch.Success)
                        {
                            zip = zipMatch.Value;
                        }
                    }
                }

                // Create project info object
                var projectInfo = new
                {
                    name = projectName,
                    zip = zip,
                    address = address,
                    projectId = projectId
                };

                string json = JsonConvert.SerializeObject(projectInfo);
                string script = $"window.revitBridge.receiveProjectInfo({json});";
                WebView.CoreWebView2.ExecuteScriptAsync(script);
                Debug.WriteLine($"Sent project info to web: {projectName}, ZIP: {zip}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error sending project info: {ex.Message}");
            }
        }

        /// <summary>
        /// Sends the current Revit UI theme to the web application.
        /// </summary>
        public void SendThemeToWebView()
        {
            if (!_isInitialized || WebView.CoreWebView2 == null)
            {
                Debug.WriteLine("SendThemeToWebView: WebView not ready");
                return;
            }

            try
            {
                UITheme currentTheme = UIThemeManager.CurrentTheme;
                bool isDark = currentTheme == UITheme.Dark;
                string themeName = isDark ? "dark" : "light";
                
                Debug.WriteLine($"SendThemeToWebView: Current Revit theme is {currentTheme} ({themeName})");
                
                var themeObj = new { name = themeName, isDark = isDark };
                string json = JsonConvert.SerializeObject(themeObj);
                
                // Use a single comprehensive script that tries all methods
                string script = $@"
                    (function() {{
                        var theme = {json};
                        console.log('Revit: Sending theme', theme);
                        
                        // Method 1: Use bridge if available
                        if (window.revitBridge && window.revitBridge.receiveTheme) {{
                            console.log('Revit: Using bridge.receiveTheme');
                            window.revitBridge.receiveTheme(theme);
                        }}
                        
                        // Method 2: Call handler directly if registered
                        if (window.onRevitTheme) {{
                            console.log('Revit: Calling onRevitTheme directly');
                            window.onRevitTheme(theme);
                        }}
                        
                        // Method 3: Queue for later
                        window.revitThemeQueue = window.revitThemeQueue || [];
                        window.revitThemeQueue.push(theme);
                        console.log('Revit: Theme queued. Queue length:', window.revitThemeQueue.length);
                    }})();
                ";
                
                WebView.CoreWebView2.ExecuteScriptAsync(script);
                Debug.WriteLine($"Sent theme to web: {themeName} (isDark: {isDark})");
                UpdateStatus($"Theme: {themeName}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error sending theme: {ex.Message}");
                Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                UpdateStatus($"Theme error: {ex.Message}");
            }
        }

        private void CoreWebView2_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
        {
            UpdateStatus($"Loading: {e.Uri}");
            Debug.WriteLine($"NavigationStarting: {e.Uri}");
        }

        private void CoreWebView2_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            Debug.WriteLine($"NavigationCompleted: IsSuccess={e.IsSuccess}, Uri={WebView.CoreWebView2?.Source}");
            
            if (e.IsSuccess)
            {
                UpdateStatus("Ready");
                
                // Stop retry timer if connection succeeded
                StopRetryTimer();
                Debug.WriteLine("NavigationCompleted: Successfully connected, stopped retry timer");
                
                // Send initial theme after page loads - try multiple times with delays
                // The delays ensure React has time to set up the handlers
                Task.Delay(500).ContinueWith(_ =>
                {
                    Dispatcher.Invoke(() => {
                        Debug.WriteLine("NavigationCompleted: Sending theme (500ms delay)");
                        SendThemeToWebView();
                    });
                });
                
                Task.Delay(1500).ContinueWith(_ =>
                {
                    Dispatcher.Invoke(() => {
                        Debug.WriteLine("NavigationCompleted: Sending theme (1500ms delay)");
                        SendThemeToWebView();
                    });
                });
                
                Task.Delay(3000).ContinueWith(_ =>
                {
                    Dispatcher.Invoke(() => {
                        Debug.WriteLine("NavigationCompleted: Sending theme (3000ms delay)");
                        SendThemeToWebView();
                        // Also send project info after page loads
                        SendProjectInfoToWebView();
                    });
                });
            }
            else
            {
                UpdateStatus($"Failed to load: {e.WebErrorStatus}");
                Debug.WriteLine($"NavigationCompleted: Failed with error {e.WebErrorStatus}");
                // Start retry timer for connection-related failures
                // WebView2 will show its own error page, and we'll retry periodically
                if (e.WebErrorStatus == CoreWebView2WebErrorStatus.ConnectionAborted ||
                    e.WebErrorStatus == CoreWebView2WebErrorStatus.CannotConnect ||
                    e.WebErrorStatus == CoreWebView2WebErrorStatus.HostNameNotResolved ||
                    e.WebErrorStatus == CoreWebView2WebErrorStatus.Disconnected)
                {
                    StartRetryTimer();
                }
            }
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string message = e.TryGetWebMessageAsString();
                Debug.WriteLine($"Message from web: {message}");
                
                // Parse message and handle requests
                try
                {
                    var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(message);
                    if (data != null && data.ContainsKey("type"))
                    {
                        string type = data["type"]?.ToString() ?? "";
                        
                        if (type == "requestTheme")
                        {
                            Debug.WriteLine("Theme requested from web, sending current theme");
                            SendThemeToWebView();
                        }
                        else if (type == "requestMaterials")
                        {
                            Debug.WriteLine("Materials requested from web");
                            
                            // Extract and cache materials if needed
                            ExtractAndCacheMaterials();
                            
                            // Send all cached materials (no pagination)
                            if (_cachedMaterials != null && _cachedMaterials.Count > 0)
                            {
                                SendMaterialsToWebView(_cachedMaterials);
                            }
                            else
                            {
                                UpdateStatus("No materials available. Please use 'Extract Materials' button first.");
                            }
                        }
                        else if (type == "extractMaterials")
                        {
                            Debug.WriteLine("Extract materials requested from web");
                            // Extract materials from active document
                            App.ExtractMaterialsFromActiveDocument();
                        }
                        else if (type == "requestProjectInfo")
                        {
                            Debug.WriteLine("Project info requested from web");
                            SendProjectInfoToWebView();
                        }
                    }
                }
                catch (Exception parseEx)
                {
                    Debug.WriteLine($"Error parsing message: {parseEx.Message}");
                    // Not a JSON message, ignore
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error processing web message: {ex.Message}");
            }
        }


        /// <summary>
        /// Starts a timer that periodically retries connecting to the web application.
        /// </summary>
        private void StartRetryTimer()
        {
            // Don't start multiple retry timers
            if (_isRetrying || _retryTimer != null)
            {
                return;
            }

            _isRetrying = true;
            _retryTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(RETRY_INTERVAL_SECONDS)
            };
            _retryTimer.Tick += RetryTimer_Tick;
            _retryTimer.Start();
            Debug.WriteLine("Started retry timer - will retry every 3 seconds");
        }

        /// <summary>
        /// Stops the retry timer.
        /// </summary>
        private void StopRetryTimer()
        {
            if (_retryTimer != null)
            {
                _retryTimer.Stop();
                _retryTimer.Tick -= RetryTimer_Tick;
                _retryTimer = null;
                _isRetrying = false;
                Debug.WriteLine("Stopped retry timer");
            }
        }

        /// <summary>
        /// Retry timer tick handler - checks if server is available before reloading.
        /// Only reloads if the server is actually reachable.
        /// </summary>
        private async void RetryTimer_Tick(object? sender, EventArgs e)
        {
            if (!_isInitialized || WebView.CoreWebView2 == null)
            {
                return;
            }

            Debug.WriteLine("Retry timer tick - checking server availability...");
            
            // Check if server is available before reloading
            try
            {
                var response = await _httpClient.GetAsync(_webAppUrl);
                if (response.IsSuccessStatusCode)
                {
                    Debug.WriteLine("Server is available - reloading page");
                    Dispatcher.Invoke(() => {
                        WebView.CoreWebView2.Reload();
                    });
                }
                else
                {
                    Debug.WriteLine($"Server responded but with status: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Server not available yet: {ex.Message}");
                // Server not available, will check again on next tick
            }
        }

        private void ShowFallbackContent(string error)
        {
            // If WebView2 completely fails, show error message
            var textBlock = new TextBlock
            {
                Text = $"Failed to initialize WebView2: {error}\n\nPlease ensure WebView2 Runtime is installed.",
                Foreground = System.Windows.Media.Brushes.White,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(20)
            };

            var grid = this.Content as System.Windows.Controls.Grid;
            if (grid != null)
            {
                grid.Children.Clear();
                grid.Children.Add(textBlock);
            }
        }

        public void UpdateStatus(string status)
        {
            // Status bar removed - just log for debugging
            Debug.WriteLine($"Status: {status}");
        }

        private void RefreshButton_Click(object sender, RoutedEventArgs e)
        {
            if (_isInitialized && WebView.CoreWebView2 != null)
            {
                LoadWebApp();
            }
        }

        private void OpenExternalButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = _webAppUrl,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                UpdateStatus($"Error opening browser: {ex.Message}");
            }
        }

        #region IDockablePaneProvider Implementation

        public void SetupDockablePane(DockablePaneProviderData data)
        {
            data.FrameworkElement = this;
            data.InitialState = new DockablePaneState
            {
                DockPosition = DockPosition.Right,
                MinimumWidth = 400,
                MinimumHeight = 300
            };
        }

        #endregion

        #region IDisposable Implementation

        private bool _disposed = false;

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                if (disposing)
                {
                    StopRetryTimer();
                    WebView?.Dispose();
                }
                _disposed = true;
            }
        }

        #endregion
    }
}

