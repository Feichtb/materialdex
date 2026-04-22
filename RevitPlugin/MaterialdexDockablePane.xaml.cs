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
        // Production URL - deployed on Netlify
        // Materialdex web app: https://materialdex.netlify.app
        private const string PRODUCTION_URL = "https://materialdex.netlify.app";
        
        // Development URL - for local development
        private const string DEVELOPMENT_URL = "http://localhost:3000";
        
        // Set to true to use production URL, false for local development
        private const bool USE_PRODUCTION = true;
        
        private const string DEFAULT_URL = USE_PRODUCTION ? PRODUCTION_URL : DEVELOPMENT_URL;
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
        /// Checks if the active document has changed from the cached document.
        /// </summary>
        private bool HasDocumentChanged()
        {
            if (App._uiApplication == null)
            {
                return false;
            }

            try
            {
                var activeDoc = App._uiApplication.ActiveUIDocument?.Document;
                
                // If no cached document, consider it changed
                if (_lastDocument == null)
                {
                    return activeDoc != null;
                }

                // If no active document, don't consider it changed
                if (activeDoc == null)
                {
                    return false;
                }

                // Compare documents by their path or GUID
                string cachedId = GetDocumentId(_lastDocument);
                string activeId = GetDocumentId(activeDoc);
                
                return cachedId != activeId;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"HasDocumentChanged: Error checking document change: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Gets a unique identifier for a document (path or GUID).
        /// </summary>
        private string GetDocumentId(Document doc)
        {
            if (doc == null)
            {
                return "";
            }

            try
            {
                // For workshared files, use central model path first (most reliable)
                if (doc.IsWorkshared)
                {
                    try
                    {
                        ModelPath centralPath = doc.GetWorksharingCentralModelPath();
                        if (centralPath != null)
                        {
                            return ModelPathUtils.ConvertModelPathToUserVisiblePath(centralPath);
                        }
                    }
                    catch
                    {
                        // Ignore errors
                    }
                }

                // Try to use path as identifier
                if (!string.IsNullOrEmpty(doc.PathName))
                {
                    return doc.PathName;
                }

                // Fallback to GUID or hash code
                return doc.ProjectInformation?.UniqueId ?? doc.GetHashCode().ToString();
            }
            catch
            {
                return doc.GetHashCode().ToString();
            }
        }

        /// <summary>
        /// Checks if the WebView is initialized and ready.
        /// </summary>
        public bool IsWebViewInitialized()
        {
            return _isInitialized && WebView.CoreWebView2 != null;
        }

        /// <summary>
        /// Refreshes materials and project info from the current active document.
        /// Can be called from App.cs to proactively update when document changes.
        /// </summary>
        public void RefreshFromActiveDocument()
        {
            if (App._uiApplication == null)
            {
                Debug.WriteLine("Cannot refresh: UIApplication not available");
                return;
            }

            try
            {
                var activeUIDoc = App._uiApplication.ActiveUIDocument;
                if (activeUIDoc == null)
                {
                    Debug.WriteLine("Cannot refresh: No active document");
                    return;
                }

                Document doc = activeUIDoc.Document;
                Debug.WriteLine($"Refreshing from document: {doc.Title ?? "Unnamed"}");

                // Update cached document
                _lastDocument = doc;
                
                // Clear cached materials to force re-extraction
                _cachedMaterials = null;
                
                // Extract materials
                try
                {
                    _cachedMaterials = MaterialExtractor.ExtractMaterials(doc);
                    Debug.WriteLine($"Extracted {_cachedMaterials.Count} materials from model");
                }
                catch (Exception extractEx)
                {
                    LogErrorToBrowserConsole($"Error extracting materials: {extractEx.Message}");
                    Debug.WriteLine($"Error extracting materials: {extractEx.Message}");
                    _cachedMaterials = new List<MaterialExtractor.ExtractedMaterial>(); // Empty list
                }
                
                // Always send project info and theme, even if materials extraction failed
                SendThemeToWebView(skipDocumentCheck: true);
                SendProjectInfoToWebView();
                
                // Send materials (even if empty)
                if (_cachedMaterials != null && _cachedMaterials.Count > 0)
                {
                    SendMaterialsToWebView(_cachedMaterials);
                }
                else
                {
                    // Send empty materials list to clear the UI
                    SendMaterialsToWebView(new List<MaterialExtractor.ExtractedMaterial>());
                }
                
                UpdateStatus($"Refreshed: {_cachedMaterials?.Count ?? 0} materials from {doc.Title ?? "current project"}");
            }
            catch (Exception ex)
            {
                LogErrorToBrowserConsole($"Error refreshing from active document: {ex.Message}");
                Debug.WriteLine($"Error refreshing from active document: {ex.Message}");
                Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                UpdateStatus($"Error refreshing: {ex.Message}");
                
                // Try to send project info anyway, even if refresh failed
                try
                {
                    SendProjectInfoToWebView();
                }
                catch { }
            }
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
        /// <param name="skipDocumentCheck">If true, skips document change check (used when called from RefreshFromActiveDocument)</param>
        public void SendThemeToWebView(bool skipDocumentCheck = false)
        {
            if (!_isInitialized || WebView.CoreWebView2 == null)
            {
                Debug.WriteLine("SendThemeToWebView: WebView not ready");
                return;
            }

            try
            {
                // Check for document changes when sending theme - this catches project switches early
                // But skip if we're already refreshing (to avoid recursion)
                if (!skipDocumentCheck && HasDocumentChanged())
                {
                    Debug.WriteLine("SendThemeToWebView: Document changed detected, refreshing");
                    RefreshFromActiveDocument();
                    return; // RefreshFromActiveDocument will send theme too
                }

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
                        SendThemeToWebView();
                        
                        // Always refresh when page loads - this ensures we get the current project
                        // even if document change detection didn't fire
                        RefreshFromActiveDocument();
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

        /// <summary>
        /// Logs an error message to the browser console for debugging.
        /// Only logs errors, not routine operations.
        /// </summary>
        private void LogErrorToBrowserConsole(string message)
        {
            // Always log to Debug output
            Debug.WriteLine($"[Revit Plugin ERROR] {message}");
            
            // Try to log to browser console if WebView is ready
            if (_isInitialized && WebView?.CoreWebView2 != null)
            {
                try
                {
                    // Escape single quotes and newlines for JavaScript
                    string escapedMessage = message.Replace("'", "\\'").Replace("\n", "\\n").Replace("\r", "");
                    string script = $"console.error('[Revit Plugin ERROR] {escapedMessage}');";
                    WebView.CoreWebView2.ExecuteScriptAsync(script);
                }
                catch { }
            }
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string message = e.TryGetWebMessageAsString();
                Debug.WriteLine($"Message from web: {message}");
                
                if (string.IsNullOrEmpty(message))
                {
                    Debug.WriteLine("ERROR: Message is null or empty");
                    return;
                }
                
                // Parse message and handle requests
                try
                {
                    var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(message);
                    if (data == null)
                    {
                        LogErrorToBrowserConsole("Failed to parse message as JSON");
                        Debug.WriteLine("ERROR: Failed to parse message as JSON");
                        return;
                    }
                    
                    if (!data.ContainsKey("type"))
                    {
                        LogErrorToBrowserConsole("Message does not contain 'type' key");
                        Debug.WriteLine("ERROR: Message does not contain 'type' key");
                        return;
                    }
                    
                    string type = data["type"]?.ToString() ?? "";
                    Debug.WriteLine($"Processing message type: {type}");
                    
                    if (type == "requestTheme")
                    {
                        Debug.WriteLine("Theme requested from web");
                        try
                        {
                            SendThemeToWebView();
                        }
                        catch (Exception ex)
                        {
                            LogErrorToBrowserConsole($"Error sending theme: {ex.Message}");
                            Debug.WriteLine($"Error sending theme: {ex.Message}");
                        }
                    }
                    else if (type == "requestMaterials")
                    {
                        Debug.WriteLine("Materials requested from web");
                        try
                        {
                            // Always check if document has changed when materials are requested
                            // This ensures auto-refresh works even if page wasn't reloaded
                            bool docChanged = HasDocumentChanged();
                            
                            if (docChanged || _lastDocument == null)
                            {
                                Debug.WriteLine("Document changed or not set when materials requested, refreshing");
                                RefreshFromActiveDocument();
                            }
                                // If no cached materials, try to extract from active document
                                else if (_cachedMaterials == null || _cachedMaterials.Count == 0)
                                {
                                    // Try to get active document and extract materials
                                    if (App._uiApplication != null)
                                    {
                                        try
                                        {
                                            var activeUIDoc = App._uiApplication.ActiveUIDocument;
                                            Debug.WriteLine($"ActiveUIDocument is null: {activeUIDoc == null}");
                                            
                                            if (activeUIDoc != null)
                                            {
                                                Document doc = activeUIDoc.Document;
                                                Debug.WriteLine($"Document title: {doc?.Title ?? "null"}");
                                                
                                                if (doc != null)
                                                {
                                                    _lastDocument = doc;
                                                    _cachedMaterials = MaterialExtractor.ExtractMaterials(doc);
                                                    Debug.WriteLine($"Extracted {_cachedMaterials.Count} materials");
                                                    UpdateStatus($"Extracted {_cachedMaterials.Count} materials from model");
                                                    
                                                    // Also send project info when document is set
                                                    SendProjectInfoToWebView();
                                                }
                                                else
                                                {
                                                    Debug.WriteLine("No active document - cannot extract materials");
                                                    UpdateStatus("Please open a Revit document first.");
                                                }
                                            }
                                        }
                                        catch (Exception ex)
                                        {
                                            UpdateStatus($"Error extracting materials: {ex.Message}");
                                            Debug.WriteLine($"Error extracting materials: {ex.Message}");
                                            Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                                        }
                                    }
                                    else
                                    {
                                        Debug.WriteLine("App._uiApplication is null - cannot extract materials");
                                        // Fallback: try to extract via App method
                                        ExtractAndCacheMaterials();
                                    }
                                }
                                
                                // Ensure we always send a response, even if empty
                                // Check again after RefreshFromActiveDocument might have updated cache
                                if (_cachedMaterials != null && _cachedMaterials.Count > 0)
                                {
                                    Debug.WriteLine($"Sending {_cachedMaterials.Count} cached materials to web");
                                    SendMaterialsToWebView(_cachedMaterials);
                                }
                                else
                                {
                                    Debug.WriteLine("No cached materials available, sending empty list");
                                    SendMaterialsToWebView(new List<MaterialExtractor.ExtractedMaterial>());
                                    UpdateStatus("No materials available. Please open a Revit document with materials.");
                                }
                            }
                            catch (Exception ex)
                            {
                                LogErrorToBrowserConsole($"Error handling requestMaterials: {ex.Message}");
                                Debug.WriteLine($"Error handling requestMaterials: {ex.Message}");
                                Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                                // Try to send empty materials list as fallback
                                try
                                {
                                    SendMaterialsToWebView(new List<MaterialExtractor.ExtractedMaterial>());
                                }
                                catch { }
                            }
                        }
                        else if (type == "extractMaterials")
                        {
                            Debug.WriteLine("Extract materials requested from web");
                            // Check if document has changed first
                            if (HasDocumentChanged())
                            {
                                Debug.WriteLine("Document changed when extract requested, refreshing");
                                RefreshFromActiveDocument();
                            }
                            else
                            {
                                // Extract materials from active document
                                App.ExtractMaterialsFromActiveDocument();
                            }
                        }
                        else if (type == "requestProjectInfo")
                        {
                            Debug.WriteLine("Project info requested from web");
                            try
                            {
                                // Always check if document has changed when project info is requested
                                // This ensures auto-refresh works even if page wasn't reloaded
                                bool docChanged = HasDocumentChanged();
                                
                                if (docChanged || _lastDocument == null)
                                {
                                    Debug.WriteLine("Document changed or not set when project info requested, refreshing");
                                    RefreshFromActiveDocument();
                                }
                                else
                                {
                                    Debug.WriteLine("Sending project info (no change detected)");
                                    SendProjectInfoToWebView();
                                }
                            }
                            catch (Exception ex)
                            {
                                LogErrorToBrowserConsole($"Error handling requestProjectInfo: {ex.Message}");
                                Debug.WriteLine($"Error handling requestProjectInfo: {ex.Message}");
                                Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                                // Try to send project info anyway
                                try
                                {
                                    SendProjectInfoToWebView();
                                }
                                catch { }
                            }
                        }
                    else if (type == "requestTheme")
                    {
                        Debug.WriteLine("Theme requested from web");
                        // Check for document changes when theme is requested - this catches project switches
                        if (HasDocumentChanged())
                        {
                            Debug.WriteLine("Document changed when theme requested, refreshing");
                            RefreshFromActiveDocument();
                        }
                        else
                        {
                            SendThemeToWebView();
                        }
                    }
                    else
                    {
                        Debug.WriteLine($"WARNING: Unknown message type: {type}");
                    }
                }
                catch (Exception parseEx)
                {
                    LogErrorToBrowserConsole($"Error parsing message: {parseEx.Message}");
                    Debug.WriteLine($"Error parsing message: {parseEx.Message}");
                    Debug.WriteLine($"Stack trace: {parseEx.StackTrace}");
                    // Not a JSON message, ignore
                }
            }
            catch (Exception ex)
            {
                LogErrorToBrowserConsole($"Error processing web message: {ex.Message}");
                Debug.WriteLine($"Error processing web message: {ex.Message}");
                Debug.WriteLine($"Stack trace: {ex.StackTrace}");
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

