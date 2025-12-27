import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { AppState, ScannedMaterial, ProductRecommendation, DocChecklist } from '@/types';
import { getSavedProducts } from './storage';

// Extend jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: {
      head?: string[][];
      body: string[][];
      startY?: number;
      margin?: { left?: number; right?: number };
      styles?: { fontSize?: number; cellPadding?: number };
      headStyles?: { fillColor?: number[]; textColor?: number[] };
      alternateRowStyles?: { fillColor?: number[] };
      columnStyles?: Record<number, { cellWidth?: number }>;
    }) => jsPDF;
    lastAutoTable?: { finalY: number };
  }
}

// Format doc status for display
function formatDocStatus(checklist: DocChecklist): string {
  const items = [
    `EPD: ${checklist.epd.status}`,
    `HPD: ${checklist.hpd.status}`,
    `Declare: ${checklist.declare.status}`,
    `VOC: ${checklist.voc.status}`,
  ];
  return items.join(' | ');
}

// Export to CSV
export function exportToCSV(state: AppState): string {
  const headers = [
    'Material Name',
    'Category',
    'Qty',
    'Unit',
    'Product',
    'Manufacturer',
    'Rationale',
    'EPD Status',
    'EPD URL',
    'HPD Status',
    'HPD URL',
    'Declare Status',
    'Declare URL',
    'VOC Status',
    'VOC URL',
    'Confidence',
  ];

  const rows: string[][] = [];
  const savedProducts = getSavedProducts(state);

  for (const { material, product } of savedProducts) {
    rows.push([
      material.name,
      material.normalized_category,
      material.qty.toString(),
      material.unit,
      product.product_label,
      product.manufacturer || 'N/A',
      product.rationale,
      product.doc_checklist.epd.status,
      product.doc_checklist.epd.doc_url || '',
      product.doc_checklist.hpd.status,
      product.doc_checklist.hpd.doc_url || '',
      product.doc_checklist.declare.status,
      product.doc_checklist.declare.doc_url || '',
      product.doc_checklist.voc.status,
      product.doc_checklist.voc.doc_url || '',
      (product.confidence * 100).toFixed(0) + '%',
    ]);
  }

  // If no saved products, export all scanned materials
  if (rows.length === 0 && state.scannedMaterials.length > 0) {
    for (const material of state.scannedMaterials) {
      for (const product of material.recommendations) {
        rows.push([
          material.name,
          material.normalized_category,
          material.qty.toString(),
          material.unit,
          product.product_label,
          product.manufacturer || 'N/A',
          product.rationale,
          product.doc_checklist.epd.status,
          product.doc_checklist.epd.doc_url || '',
          product.doc_checklist.hpd.status,
          product.doc_checklist.hpd.doc_url || '',
          product.doc_checklist.declare.status,
          product.doc_checklist.declare.doc_url || '',
          product.doc_checklist.voc.status,
          product.doc_checklist.voc.doc_url || '',
          (product.confidence * 100).toFixed(0) + '%',
        ]);
      }
    }
  }

  // Escape CSV values
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  return csvContent;
}

// Download CSV file
export function downloadCSV(state: AppState, filename: string = 'materialdex-export.csv'): void {
  const csv = exportToCSV(state);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export to PDF
export function exportToPDF(state: AppState, filename: string = 'materialdex-binder-index.pdf'): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Materialdex Binder Index', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Project Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${state.project.name}`, 20, yPos);
  yPos += 7;
  doc.text(`Location: ZIP ${state.project.zip}`, 20, yPos);
  yPos += 7;
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPos);
  yPos += 10;

  // Goals
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Sustainability Goals:', 20, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  const goalsLines = doc.splitTextToSize(state.project.goals, pageWidth - 40);
  doc.text(goalsLines, 20, yPos);
  yPos += goalsLines.length * 5 + 10;

  // Disclaimer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('DISCLAIMER: Recommendations may include unverified claims. Always verify by opening source documents.', 20, yPos);
  doc.setTextColor(0);
  yPos += 15;

  // Get saved products or all products
  const savedProducts = getSavedProducts(state);
  const productsToExport = savedProducts.length > 0 ? savedProducts : 
    state.scannedMaterials.flatMap(m => m.recommendations.map(p => ({ material: m, product: p })));

  if (productsToExport.length === 0) {
    doc.setFontSize(12);
    doc.text('No products have been scanned or saved yet.', 20, yPos);
  } else {
    // Group by material
    const byMaterial = new Map<string, { material: ScannedMaterial; products: ProductRecommendation[] }>();
    for (const { material, product } of productsToExport) {
      if (!byMaterial.has(material.id)) {
        byMaterial.set(material.id, { material, products: [] });
      }
      byMaterial.get(material.id)!.products.push(product);
    }

    // Create table data
    const tableData: string[][] = [];
    for (const { material, products } of Array.from(byMaterial.values())) {
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        tableData.push([
          i === 0 ? material.name : '',
          i === 0 ? material.normalized_category : '',
          product.product_label,
          formatDocStatus(product.doc_checklist),
        ]);
      }
    }

    // Add table
    doc.autoTable({
      head: [['Material', 'Category', 'Product', 'Documentation Status']],
      body: tableData,
      startY: yPos,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 35 },
        2: { cellWidth: 45 },
        3: { cellWidth: 50 },
      },
    });
  }

  // Save the PDF
  doc.save(filename);
}

