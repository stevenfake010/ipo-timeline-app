// src/components/ExcelExport.jsx
import React from 'react';
import { Download } from 'lucide-react';
import { generateExcel, downloadBlob } from '../utils/excelGenerator';

export function ExcelExport({ tasks, anchors, totalWeeks }) {
  const handleExport = () => {
    const blob = generateExcel(tasks, anchors, totalWeeks);
    const filename = `IPO时间表_${new Date().toISOString().split('T')[0]}.xlsx`;
    downloadBlob(blob, filename);
  };

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      导出Excel
    </button>
  );
}