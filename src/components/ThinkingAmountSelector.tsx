import { useRef, useState, useEffect } from 'preact/hooks';
import { isThinkingModel, getThinkingPresetsForModel, getDefaultThinkingAmount } from '../utils/thinkingModels';
import type { ThinkingPreset } from '../utils/thinkingModels';

interface ThinkingAmountSelectorProps {
  model?: string;
  selectedAmount?: string;
  onAmountChange: (amount: string) => void;
  className?: string;
}

export function ThinkingAmountSelector({
  model,
  selectedAmount,
  onAmountChange,
  className = ''
}: ThinkingAmountSelectorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Only show if model supports thinking
  if (!model || !isThinkingModel(model)) {
    return null;
  }

  const presets = getThinkingPresetsForModel(model);
  if (presets.length === 0) {
    return null;
  }

  const currentAmount = selectedAmount || getDefaultThinkingAmount(model);
  const currentPreset = presets.find(p => p.value === currentAmount);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectPreset = (preset: ThinkingPreset) => {
    onAmountChange(preset.value);
    setIsOpen(false);
  };

  return (
    <div
      class={`thinking-amount-selector ${className}`}
      ref={dropdownRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        marginRight: '12px',
        position: 'relative'
      }}
    >
      <button
        class="thinking-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Thinking amount"
        style={{
          padding: '6px 12px',
          backgroundColor: '#f0f0f0',
          border: '1px solid #d0d0d0',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap'
        }}
      >
        <span style={{ fontSize: '16px' }}>💭</span>
        <span>{currentPreset?.label || 'Thinking'}</span>
        <span style={{ fontSize: '12px' }}>▼</span>
      </button>

      {isOpen && (
        <div
          class="thinking-dropdown-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            marginTop: '4px',
            backgroundColor: 'white',
            border: '1px solid #d0d0d0',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '200px'
          }}
        >
          {presets.map((preset) => (
            <button
              key={preset.value}
              class={`thinking-preset-item ${preset.value === currentAmount ? 'selected' : ''}`}
              onClick={() => handleSelectPreset(preset)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: preset.value === currentAmount ? '#f0f0f0' : 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                fontSize: '14px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (preset.value !== currentAmount) {
                  (e.target as HTMLElement).style.backgroundColor = '#f9f9f9';
                }
              }}
              onMouseLeave={(e) => {
                if (preset.value !== currentAmount) {
                  (e.target as HTMLElement).style.backgroundColor = 'white';
                }
              }}
            >
              <div style={{ fontWeight: preset.value === currentAmount ? 'bold' : 'normal' }}>
                {preset.label}
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
