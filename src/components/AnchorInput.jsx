// src/components/AnchorInput.jsx
import React, { useState } from 'react';
import { Calendar, Calculator } from 'lucide-react';

export function AnchorInput({ onGenerate }) {
  const [startDate, setStartDate] = useState('2024-01-15');
  const [baseDate, setBaseDate] = useState('2024-03-31');
  const [filingDate, setFilingDate] = useState('2024-06-30');

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate({
      startDate: new Date(startDate),
      baseDate: new Date(baseDate),
      filingDate: new Date(filingDate),
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        项目锚点设置
      </h2>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            项目启动时间
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            项目申报基准日
          </label>
          <input
            type="date"
            value={baseDate}
            onChange={(e) => setBaseDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            项目申报时间 (A1)
          </label>
          <input
            type="date"
            value={filingDate}
            onChange={(e) => setFilingDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-3 mt-4">
          <button
            type="submit"
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            生成时间表
          </button>
        </div>
      </form>
    </div>
  );
}