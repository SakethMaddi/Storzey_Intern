import React, { useState, forwardRef } from "react";

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ wrapperClassName = "", wrapperStyle, className = "", style, disabled, ...rest }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div
        className={`password-input-wrapper ${wrapperClassName}`.trim()}
        style={wrapperStyle}
      >
        <input
          {...rest}
          ref={ref}
          type={showPassword ? "text" : "password"}
          disabled={disabled}
          className={className}
          style={style}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShowPassword((prev) => !prev)}
          onMouseDown={(e) => e.preventDefault()}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          title={showPassword ? "Hide password" : "Show password"}
          tabIndex={0}
        >
          {showPassword ? (
            /* Eye Off / Slashed Eye icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            /* Eye icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
export default PasswordInput;

