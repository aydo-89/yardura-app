import React from "react";
import { useIMask } from "react-imask";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface MaskedInputProps {
  mask: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  type?: string;
  id?: string;
  name?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
  onBlur?: () => void;
}

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  (
    {
      mask,
      value,
      onChange,
      placeholder,
      className,
      disabled,
      type = "text",
      onBlur,
      ...props
    },
    ref,
  ) => {
    const maskOptions = mask === "(999) 999-9999" ? "(000) 000-0000" : mask;

    const {
      ref: imaskRef,
      value: imaskValue,
      setValue: setImaskValue,
      unmaskedValue,
    } = useIMask({
      mask: maskOptions,
      lazy: false,
    });

    // Sync external value changes with IMask
    React.useEffect(() => {
      if (value !== unmaskedValue) {
        setImaskValue(value);
      }
    }, [value, unmaskedValue, setImaskValue]);

    // Notify parent of changes
    React.useEffect(() => {
      if (unmaskedValue !== value) {
        onChange(unmaskedValue);
      }
    }, [unmaskedValue, onChange, value]);

    const handleBlur = () => {
      if (onBlur) {
        onBlur();
      }
    };

    return (
      <input
        {...props}
        ref={(el) => {
          // Set both refs
          if (imaskRef.current !== el) {
            imaskRef.current = el;
          }
          if (ref && typeof ref === "function") {
            ref(el);
          } else if (ref && "current" in ref) {
            ref.current = el;
          }
        }}
        value={imaskValue}
        onChange={() => {}} // Controlled by IMask
        onBlur={handleBlur}
        type={type}
        placeholder={placeholder}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        disabled={disabled}
      />
    );
  },
);

MaskedInput.displayName = "MaskedInput";

export { MaskedInput };
