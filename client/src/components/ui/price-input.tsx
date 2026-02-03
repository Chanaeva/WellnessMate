import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PriceInputProps {
  value: number;
  onChange: (cents: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "data-testid"?: string;
}

export function PriceInput({
  value,
  onChange,
  className,
  placeholder = "0.00",
  disabled,
  id,
  "data-testid": dataTestId,
}: PriceInputProps) {
  const [displayValue, setDisplayValue] = useState(() => 
    value ? (value / 100).toFixed(2) : ""
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value ? (value / 100).toFixed(2) : "");
    }
  }, [value, isFocused]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    if (input === "" || /^\d*\.?\d{0,2}$/.test(input)) {
      setDisplayValue(input);
    }
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const numValue = parseFloat(displayValue || "0");
    const cents = Math.round(numValue * 100);
    onChange(cents);
    setDisplayValue(cents ? (cents / 100).toFixed(2) : "");
  }, [displayValue, onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={cn("pl-7", className)}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        data-testid={dataTestId}
      />
    </div>
  );
}
