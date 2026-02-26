interface CheckBoxProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function CheckBox({ checked, onToggle, disabled }: CheckBoxProps) {
  return (
    <div className="flex items-center justify-center w-8">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`w-[22px] h-[22px] rounded-md border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer
          ${checked ? 'bg-green border-green' : 'bg-surface border-border hover:border-green hover:bg-green/5'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <svg
          className={`w-3 h-3 stroke-white stroke-[2.5] fill-none transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
          viewBox="0 0 12 12"
        >
          <polyline points="2,6 5,9 10,3" />
        </svg>
      </button>
    </div>
  );
}
