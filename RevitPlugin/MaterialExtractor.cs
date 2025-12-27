using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;

namespace Materialdex
{
    /// <summary>
    /// Extracts materials from a Revit document for analysis by Materialdex.
    /// </summary>
    public static class MaterialExtractor
    {
        /// <summary>
        /// Data structure representing an extracted material.
        /// </summary>
        public class ExtractedMaterial
        {
            public string Id { get; set; } = "";
            public string Name { get; set; } = "";
            public double Quantity { get; set; }
            public string Unit { get; set; } = "sf";
            public string Category { get; set; } = "";
            public string ElementTypes { get; set; } = "";
        }

        /// <summary>
        /// Extracts all materials used in the Revit document with quantities.
        /// </summary>
        public static List<ExtractedMaterial> ExtractMaterials(Document doc)
        {
            var materialDict = new Dictionary<ElementId, ExtractedMaterial>();
            var elementTypesByMaterial = new Dictionary<ElementId, HashSet<string>>();

            // Get all elements that can have materials
            FilteredElementCollector collector = new FilteredElementCollector(doc)
                .WhereElementIsNotElementType();

            foreach (Element elem in collector)
            {
                // Skip elements without geometry
                if (elem.Category == null) continue;
                
                // Get material IDs from the element
                ICollection<ElementId> materialIds = GetMaterialIds(elem);
                
                foreach (ElementId matId in materialIds)
                {
                    if (matId == ElementId.InvalidElementId) continue;
                    
                    Material? mat = doc.GetElement(matId) as Material;
                    if (mat == null) continue;

                    // Try to get material area from the element
                    double area = GetMaterialArea(elem, matId);
                    
                    // Track element types using this material
                    if (!elementTypesByMaterial.ContainsKey(matId))
                    {
                        elementTypesByMaterial[matId] = new HashSet<string>();
                    }
                    if (elem.Category != null)
                    {
                        elementTypesByMaterial[matId].Add(elem.Category.Name);
                    }

                    if (materialDict.ContainsKey(matId))
                    {
                        // Accumulate area and round to 2 decimal places
                        materialDict[matId].Quantity = Math.Round(materialDict[matId].Quantity + area, 2);
                    }
                    else
                    {
                        materialDict[matId] = new ExtractedMaterial
                        {
                            Id = matId.ToString(),
                            Name = mat.Name,
                            Quantity = Math.Round(area, 2),
                            Unit = "sf",
                            Category = GetMaterialCategory(mat)
                        };
                    }
                }
            }

            // Add element types to materials
            foreach (var kvp in materialDict)
            {
                if (elementTypesByMaterial.TryGetValue(kvp.Key, out var types))
                {
                    kvp.Value.ElementTypes = string.Join(", ", types.Take(5));
                }
            }

            // Round all quantities to 2 decimal places and filter out materials with zero quantity
            var materialsList = materialDict.Values
                .Select(m => {
                    m.Quantity = Math.Round(m.Quantity, 2);
                    return m;
                })
                .Where(m => m.Quantity > 0 || !string.IsNullOrEmpty(m.Name))
                .OrderByDescending(m => m.Quantity)  // Primary sort: quantity (area or volume) descending - most used materials first
                .ThenBy(m => m.Name)                 // Secondary sort: alphabetical when quantities are equal
                .ToList();
            
            return materialsList;
        }

        /// <summary>
        /// Gets paginated materials from a list, sorted by quantity (area or volume) descending.
        /// </summary>
        /// <param name="allMaterials">Full list of materials (should already be sorted by quantity)</param>
        /// <param name="skip">Number of materials to skip</param>
        /// <param name="take">Number of materials to take</param>
        /// <returns>Paginated list of materials</returns>
        public static List<ExtractedMaterial> GetPaginatedMaterials(
            List<ExtractedMaterial> allMaterials,
            int skip,
            int take)
        {
            return allMaterials
                .Skip(skip)
                .Take(take)
                .ToList();
        }

        /// <summary>
        /// Gets all material IDs from an element, handling different element types.
        /// </summary>
        private static ICollection<ElementId> GetMaterialIds(Element elem)
        {
            var materialIds = new List<ElementId>();

            try
            {
                // Try to get geometry and extract materials
                Options geomOptions = new Options();
                GeometryElement? geomElem = elem.get_Geometry(geomOptions);

                if (geomElem != null)
                {
                    foreach (GeometryObject geomObj in geomElem)
                    {
                        ExtractMaterialsFromGeometry(geomObj, materialIds);
                    }
                }

                // For some elements, also check the GetMaterialIds method directly
                if (elem is FamilyInstance fi)
                {
                    var fiMaterials = fi.GetMaterialIds(false);
                    materialIds.AddRange(fiMaterials);
                }
            }
            catch
            {
                // Some elements may not support geometry extraction
            }

            return materialIds.Distinct().ToList();
        }

        /// <summary>
        /// Recursively extracts materials from geometry objects.
        /// </summary>
        private static void ExtractMaterialsFromGeometry(GeometryObject geomObj, List<ElementId> materialIds)
        {
            if (geomObj is Solid solid)
            {
                foreach (Face face in solid.Faces)
                {
                    ElementId matId = face.MaterialElementId;
                    if (matId != ElementId.InvalidElementId)
                    {
                        materialIds.Add(matId);
                    }
                }
            }
            else if (geomObj is GeometryInstance instance)
            {
                GeometryElement? instanceGeom = instance.GetInstanceGeometry();
                if (instanceGeom != null)
                {
                    foreach (GeometryObject obj in instanceGeom)
                    {
                        ExtractMaterialsFromGeometry(obj, materialIds);
                    }
                }
            }
        }

        /// <summary>
        /// Gets the material area for a specific material on an element.
        /// Returns area in square feet.
        /// </summary>
        private static double GetMaterialArea(Element elem, ElementId materialId)
        {
            try
            {
                double area = elem.GetMaterialArea(materialId, false);
                // Convert from internal units (sq ft) if needed
                return area;
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>
        /// Determines a category for the material based on its properties.
        /// </summary>
        private static string GetMaterialCategory(Material mat)
        {
            string name = mat.Name.ToLower();

            // Try to categorize based on name
            if (name.Contains("concrete") || name.Contains("cement"))
                return "Concrete";
            if (name.Contains("steel") || name.Contains("metal") || name.Contains("aluminum"))
                return "Metals";
            if (name.Contains("wood") || name.Contains("lumber") || name.Contains("plywood"))
                return "Wood";
            if (name.Contains("glass") || name.Contains("glazing"))
                return "Glass";
            if (name.Contains("insulation") || name.Contains("foam"))
                return "Insulation";
            if (name.Contains("gypsum") || name.Contains("drywall"))
                return "Gypsum";
            if (name.Contains("brick") || name.Contains("masonry") || name.Contains("cmu"))
                return "Masonry";
            if (name.Contains("paint") || name.Contains("coating") || name.Contains("finish"))
                return "Finishes";
            if (name.Contains("carpet") || name.Contains("flooring") || name.Contains("tile"))
                return "Flooring";
            if (name.Contains("roofing") || name.Contains("membrane") || name.Contains("shingle"))
                return "Roofing";

            // Default category based on material class
            if (mat.MaterialClass != null && !string.IsNullOrEmpty(mat.MaterialClass))
            {
                return mat.MaterialClass;
            }

            return "Other";
        }
    }
}

