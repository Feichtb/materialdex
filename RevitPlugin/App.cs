using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Windows.Media.Imaging;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Autodesk.Revit.UI.Events;

namespace Materialdex
{
    /// <summary>
    /// Main application class that initializes the Materialdex plugin for Revit 2026.
    /// Creates a ribbon panel with buttons to launch the Materialdex web interface.
    /// </summary>
    public class App : IExternalApplication
    {
        // Static reference for panel access across commands
        public static MaterialdexDockablePane? DockablePane { get; private set; }
        public static DockablePaneId DockablePaneId => new DockablePaneId(new Guid("B8E5C9A2-3B7D-4E6F-8A1C-9D2E3F4B5C6B"));
        internal static UIApplication? _uiApplication;
        private static bool _idlingHandlerRegistered = false;
        private static Document? _lastCheckedDocument = null;
        
        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                // Use the simpler overload that automatically adds to the Add-Ins tab
                // CreateRibbonPanel(string panelName) adds panel to Add-Ins tab by default
                RibbonPanel panel = application.CreateRibbonPanel("Materialdex");

                // Get assembly path for command binding
                string assemblyPath = Assembly.GetExecutingAssembly().Location;

                // Create Show Panel button
                PushButtonData showPanelButtonData = new PushButtonData(
                    "ShowMaterialdex",
                    "Materialdex",
                    assemblyPath,
                    "Materialdex.ShowPanelCommand"
                );
                showPanelButtonData.ToolTip = "Open Materialdex - Sustainable Materials Panel";
                showPanelButtonData.LongDescription = "Opens a panel that helps you find sustainable building material alternatives with EPD, HPD, Declare, and VOC documentation.";
                
                // Load icons from file system (more reliable than embedded resources)
                try
                {
                    string assemblyDir = Path.GetDirectoryName(assemblyPath) ?? "";
                    string largeIconPath = Path.Combine(assemblyDir, "Resources", "materialdex-32.png");
                    string smallIconPath = Path.Combine(assemblyDir, "Resources", "materialdex-16.png");
                    
                    var largeIcon = LoadIconFromFile(largeIconPath, 32);
                    var smallIcon = LoadIconFromFile(smallIconPath, 16);
                    
                    if (largeIcon != null)
                        showPanelButtonData.LargeImage = largeIcon;
                    if (smallIcon != null)
                        showPanelButtonData.Image = smallIcon;
                }
                catch (Exception)
                {
                    // Icons not available, button will use default
                }

                panel.AddItem(showPanelButtonData);

                // Register the dockable pane
                RegisterDockablePane(application);

                // Register Idling event to capture UIApplication
                // This is needed because the panel might auto-show from a previous session
                // before the user clicks the button
                application.Idling += OnIdling;
                _idlingHandlerRegistered = true;

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Materialdex Error", $"Failed to initialize Materialdex: {ex.Message}");
                return Result.Failed;
            }
        }

        /// <summary>
        /// Idling event handler to capture UIApplication and detect document changes.
        /// This ensures we have access to the active document even if the panel auto-shows.
        /// Also checks for document changes and proactively sends updates to the web app.
        /// </summary>
        private void OnIdling(object? sender, IdlingEventArgs e)
        {
            // Capture UIApplication on first idle
            if (_uiApplication == null && sender is UIApplication uiApp)
            {
                _uiApplication = uiApp;
                Debug.WriteLine("Materialdex: Captured UIApplication via Idling event");
            }

            // Check for document changes and proactively send updates
            // Only check if the pane is shown and initialized
            if (DockablePane != null && DockablePane.IsInitialized() && _uiApplication != null)
            {
                try
                {
                    var activeDoc = _uiApplication.ActiveUIDocument?.Document;
                    
                    // Check if document changed
                    if (activeDoc != null && activeDoc != _lastCheckedDocument)
                    {
                        // Get document ID for comparison
                        string currentDocId = GetDocumentId(activeDoc);
                        string lastDocId = _lastCheckedDocument != null ? GetDocumentId(_lastCheckedDocument) : "";
                        
                        if (currentDocId != lastDocId)
                        {
                            Debug.WriteLine($"Materialdex: Document changed detected via Idling event: {activeDoc.Title}");
                            _lastCheckedDocument = activeDoc;
                            
                            // Proactively refresh the web app with new document data
                            DockablePane.RefreshFromActiveDocument();
                        }
                    }
                    else if (_lastCheckedDocument == null && activeDoc != null)
                    {
                        // First time detecting a document
                        _lastCheckedDocument = activeDoc;
                        Debug.WriteLine($"Materialdex: Initial document detected via Idling event: {activeDoc.Title}");
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Materialdex: Error checking document in Idling handler: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Gets a unique identifier for a document (path or GUID).
        /// </summary>
        private string GetDocumentId(Document doc)
        {
            if (doc == null) return "";

            // Try to use path as identifier
            if (!string.IsNullOrEmpty(doc.PathName))
            {
                return doc.PathName;
            }

            // For workshared files, use central model path
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

            // Fallback to GUID or hash code
            return doc.ProjectInformation?.UniqueId ?? doc.GetHashCode().ToString();
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            // Unregister Idling event
            if (_idlingHandlerRegistered)
            {
                application.Idling -= OnIdling;
                _idlingHandlerRegistered = false;
            }
            
            // Cleanup if needed
            DockablePane?.Dispose();
            return Result.Succeeded;
        }

        private void RegisterDockablePane(UIControlledApplication application)
        {
            DockablePane = new MaterialdexDockablePane();
            DockablePane.SetUIControlledApplication(application);
            application.RegisterDockablePane(
                DockablePaneId,
                "Materialdex - Sustainable Materials",
                DockablePane
            );
        }

        /// <summary>
        /// Extracts materials from the active document and sends them to the web view.
        /// Can be called from the web app via JavaScript bridge.
        /// </summary>
        public static void ExtractMaterialsFromActiveDocument()
        {
            if (_uiApplication == null)
            {
                DockablePane?.UpdateStatus("Cannot extract materials: UIApplication not available");
                return;
            }

            try
            {
                Document doc = _uiApplication.ActiveUIDocument.Document;
                var materials = MaterialExtractor.ExtractMaterials(doc);
                
                if (materials.Count == 0)
                {
                    DockablePane?.UpdateStatus("No materials found in the current document.");
                    return;
                }

                // Cache document and materials in the dockable pane
                DockablePane?.SetDocumentAndExtract(doc);
                
                // Send materials to the web view
                DockablePane?.SendMaterialsToWebView(materials);
                
                DockablePane?.UpdateStatus($"Extracted {materials.Count} materials from the model");
            }
            catch (Exception ex)
            {
                DockablePane?.UpdateStatus($"Error extracting materials: {ex.Message}");
            }
        }

        /// <summary>
        /// Loads an icon from file and ensures it's properly sized and DPI-corrected for Revit.
        /// This approach is more reliable than embedded resources for Revit ribbon icons.
        /// </summary>
        /// <param name="filePath">Path to the PNG icon file</param>
        /// <param name="targetSize">Expected size (16 for small, 32 for large)</param>
        /// <returns>BitmapSource suitable for Revit ribbon, or null if loading fails</returns>
        private static System.Windows.Media.Imaging.BitmapSource? LoadIconFromFile(string filePath, int targetSize)
        {
            try
            {
                if (!File.Exists(filePath))
                    return null;

                // Load the image from file
                var uri = new Uri(filePath, UriKind.Absolute);
                var decoder = BitmapDecoder.Create(uri, BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
                
                if (decoder.Frames.Count == 0) 
                    return null;

                var sourceFrame = decoder.Frames[0];
                
                // CRITICAL: Create a new bitmap with exactly the target size and 96 DPI
                // This fixes the "1/4 image" issue which occurs when:
                // 1. The image has high DPI metadata (e.g., 192 DPI from high-DPI monitors)
                // 2. The image dimensions don't match what Revit expects
                
                // Force the image to the exact target size at 96 DPI
                var targetBitmap = new System.Windows.Media.Imaging.TransformedBitmap(
                    sourceFrame,
                    new System.Windows.Media.ScaleTransform(
                        (double)targetSize / sourceFrame.PixelWidth,
                        (double)targetSize / sourceFrame.PixelHeight
                    )
                );

                // Create final bitmap with explicit 96 DPI (standard Windows DPI)
                var stride = targetSize * 4; // 4 bytes per pixel for BGRA32
                var pixels = new byte[stride * targetSize];
                
                // Convert to Bgra32 format for consistent handling
                var convertedBitmap = new System.Windows.Media.Imaging.FormatConvertedBitmap(
                    targetBitmap,
                    System.Windows.Media.PixelFormats.Bgra32,
                    null,
                    0
                );
                convertedBitmap.CopyPixels(pixels, stride, 0);

                var bitmapSource = BitmapSource.Create(
                    targetSize,
                    targetSize,
                    96.0, // DPI X - standard Windows DPI (CRITICAL for Revit)
                    96.0, // DPI Y - standard Windows DPI (CRITICAL for Revit)
                    System.Windows.Media.PixelFormats.Bgra32,
                    null,
                    pixels,
                    stride
                );
                
                bitmapSource.Freeze();
                return bitmapSource;
            }
            catch
            {
                return null;
            }
        }
    }

    /// <summary>
    /// Command to show/toggle the Materialdex dockable panel.
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class ShowPanelCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                // Store UIApplication reference for material extraction
                App._uiApplication = commandData.Application;
                
                DockablePane? pane = commandData.Application.GetDockablePane(App.DockablePaneId);
                
                if (pane != null)
                {
                    if (pane.IsShown())
                    {
                        pane.Hide();
                    }
                    else
                    {
                        pane.Show();
                    }
                }
                else
                {
                    TaskDialog.Show("Materialdex", "The Materialdex panel could not be found. Please restart Revit.");
                    return Result.Failed;
                }

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }
        }
    }

}

