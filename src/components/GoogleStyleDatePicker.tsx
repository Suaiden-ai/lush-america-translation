import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { DateRange } from './DateRangeFilter';

interface GoogleStyleDatePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;
  className?: string;
}

export function GoogleStyleDatePicker({ 
  dateRange, 
  onDateRangeChange, 
  className = '' 
}: GoogleStyleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');
  const [openUpward, setOpenUpward] = useState(false);
  const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null);

  // Atualizar datas temporárias quando o dateRange muda
  useEffect(() => {
    if (dateRange.startDate) {
      setTempStartDate(dateRange.startDate.toISOString().split('T')[0]);
    } else {
      setTempStartDate('');
    }
    
    if (dateRange.endDate) {
      setTempEndDate(dateRange.endDate.toISOString().split('T')[0]);
    } else {
      setTempEndDate('');
    }
  }, [dateRange]);

  // Função para detectar se deve abrir para cima
  const checkPosition = () => {
    if (!buttonRef) return;
    
    const rect = buttonRef.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 400; // Altura aproximada do dropdown
    
    // Se não há espaço suficiente abaixo, abrir para cima
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Só abrir para cima se houver mais espaço acima e não houver espaço suficiente abaixo
    setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight);
  };

  // Detectar posição quando o dropdown abre
  useEffect(() => {
    if (isOpen) {
      checkPosition();
    }
  }, [isOpen, buttonRef]);

  // Recalcular posição quando a janela é redimensionada
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        checkPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [isOpen, buttonRef]);

  const handlePresetClick = (preset: string) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let newStartDate: Date | null = null;
    let newEndDate: Date | null = now;

    switch (preset) {
      case 'today':
        newStartDate = new Date(startOfToday);
        newEndDate = new Date(startOfToday);
        break;
      case 'yesterday':
        newStartDate = new Date(startOfToday);
        newStartDate.setDate(startOfToday.getDate() - 1);
        newEndDate = new Date(startOfToday);
        newEndDate.setDate(startOfToday.getDate() - 1);
        break;
      case '7d':
        newStartDate = new Date(startOfToday);
        newStartDate.setDate(startOfToday.getDate() - 7);
        break;
      case '30d':
        newStartDate = new Date(startOfToday);
        newStartDate.setDate(startOfToday.getDate() - 30);
        break;
      case '90d':
        newStartDate = new Date(startOfToday);
        newStartDate.setDate(startOfToday.getDate() - 90);
        break;
      case 'year':
        newStartDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
      default:
        newStartDate = null;
        newEndDate = null;
        preset = 'all';
    }

    onDateRangeChange({
      startDate: newStartDate,
      endDate: newEndDate,
      preset
    });
    setIsOpen(false);
  };

  const handleCustomDateApply = () => {
    // Criar datas no timezone local para evitar problemas de conversão UTC
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (tempStartDate) {
      const [year, month, day] = tempStartDate.split('-').map(Number);
      startDate = new Date(year, month - 1, day, 0, 0, 0, 0); // Criar no timezone local
    }

    if (tempEndDate) {
      const [year, month, day] = tempEndDate.split('-').map(Number);
      endDate = new Date(year, month - 1, day, 23, 59, 59, 999); // Fim do dia no timezone local
    }

    // Validar datas
    if (startDate && endDate && startDate > endDate) {
      alert('Start date must be before end date');
      return;
    }

    onDateRangeChange({
      startDate,
      endDate,
      preset: 'custom'
    });
    setIsOpen(false);
  };

  const handleClearDates = () => {
    setTempStartDate('');
    setTempEndDate('');
    onDateRangeChange({
      startDate: null,
      endDate: null,
      preset: 'all'
    });
    setIsOpen(false);
  };

  const formatDateRange = () => {
    if (dateRange.preset === 'custom') {
      if (dateRange.startDate && dateRange.endDate) {
        // Formatar datas corretamente no formato MM/DD/YYYY sem problemas de timezone
        const formatDate = (date: Date) => {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const year = date.getFullYear();
          return `${month}/${day}/${year}`;
        };
        return `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
      } else if (dateRange.startDate) {
        const formatDate = (date: Date) => {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const year = date.getFullYear();
          return `${month}/${day}/${year}`;
        };
        return `From ${formatDate(dateRange.startDate)}`;
      } else if (dateRange.endDate) {
        const formatDate = (date: Date) => {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const year = date.getFullYear();
          return `${month}/${day}/${year}`;
        };
        return `Until ${formatDate(dateRange.endDate)}`;
      }
    }
    
    const presetLabels: { [key: string]: string } = {
      'all': 'All time',
      'today': 'Today',
      'yesterday': 'Yesterday',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      'year': 'This year'
    };
    
    return presetLabels[dateRange.preset || 'all'] || 'Select period';
  };

  const presets = [
    { value: 'all', label: 'All time', icon: '📅' },
    { value: 'today', label: 'Today', icon: '📆' },
    { value: 'yesterday', label: 'Yesterday', icon: '📅' },
    { value: '7d', label: 'Last 7 days', icon: '📊' },
    { value: '30d', label: 'Last 30 days', icon: '📈' },
    { value: '90d', label: 'Last 90 days', icon: '📉' },
    { value: 'year', label: 'This year', icon: '🗓️' }
  ];

  return (
    <div className={`relative ${className}`}>
      <button
        ref={setButtonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white hover:bg-gray-50 min-w-[200px] transition-all duration-200"
        aria-label="Selecionar período"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-left truncate text-gray-700">{formatDateRange()}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute right-0 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden transition-all duration-200 ${
          openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
                  <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Filter by period</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Presets */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-3">
              Quick periods
            </label>
              <div className="grid grid-cols-1 gap-1">
                {presets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePresetClick(preset.value)}
                    className={`flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                      dateRange.preset === preset.value
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-base">{preset.icon}</span>
                    <span className="flex-1 text-left">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-3">
                Custom period
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    max={tempEndDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    End date
                  </label>
                  <input
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    min={tempStartDate}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <button
                onClick={handleClearDates}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear filters
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomDateApply}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay para fechar o dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
