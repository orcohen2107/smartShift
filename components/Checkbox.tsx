'use client';

import React from 'react';
import styled from 'styled-components';

const CHECKBOX_SIZE = 16;

type CheckboxProps = {
  id: string;
  label: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
};

function sanitizeIdForSvg(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, '_');
}

export default function Checkbox({
  id,
  label,
  checked,
  onChange,
  name,
  disabled,
  className,
}: CheckboxProps) {
  const maskId = `checkbox-mask-${sanitizeIdForSvg(id)}`;

  return (
    <StyledWrapper className={className}>
      <div className="checkbox-wrapper">
        <input
          id={id}
          name={name ?? id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <label className="terms-label" htmlFor={id}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 200 200"
            className="checkbox-svg"
          >
            <mask fill="white" id={maskId}>
              <rect height={200} width={200} />
            </mask>
            <rect
              mask={`url(#${maskId})`}
              fill="#ffffff"
              strokeWidth={40}
              className="checkbox-box"
              height={200}
              width={200}
            />
            <path
              strokeWidth={15}
              d="M52 111.018L76.9867 136L149 64"
              className="checkbox-tick"
            />
          </svg>
          <span className="label-text">{label}</span>
        </label>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .checkbox-wrapper input[type='checkbox'] {
    display: none;
  }

  .checkbox-wrapper .terms-label {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .checkbox-wrapper input[type='checkbox']:disabled + .terms-label {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .checkbox-wrapper .terms-label .label-text {
    font-size: 0.75rem;
    font-weight: 500;
    color: #171717;
  }

  @media (prefers-color-scheme: dark) {
    .checkbox-wrapper .terms-label .label-text {
      color: rgb(24, 24, 27);
    }
  }

  html.dark & .checkbox-wrapper .terms-label .label-text {
    color: #d4d4d8;
  }

  .checkbox-wrapper .checkbox-svg {
    width: ${CHECKBOX_SIZE}px;
    height: ${CHECKBOX_SIZE}px;
    flex-shrink: 0;
  }

  /* תיבה: מילוי תואם theme; מסגרת אפורה כשלא מסומן, ירוק כש מסומן */
  .checkbox-wrapper .checkbox-box {
    fill: #ffffff;
    stroke: #d4d4d8;
    stroke-dasharray: 800;
    stroke-dashoffset: 0;
    transition:
      stroke 0.2s ease,
      stroke-dashoffset 0.6s ease-in;
  }

  .checkbox-wrapper .checkbox-tick {
    stroke: #10b981;
    stroke-dasharray: 172;
    stroke-dashoffset: 172;
    transition: stroke-dashoffset 0.6s ease-in;
  }

  @media (prefers-color-scheme: dark) {
    .checkbox-wrapper .checkbox-box {
      fill: rgb(229, 229, 235);
      stroke: rgb(5, 5, 6);
    }
  }

  html.dark & .checkbox-wrapper .checkbox-box {
    fill: #18181b;
    stroke: #52525b;
  }

  .checkbox-wrapper
    input[type='checkbox']:checked
    + .terms-label
    .checkbox-box {
    stroke: #10b981;
    stroke-dashoffset: 0;
  }

  .checkbox-wrapper
    input[type='checkbox']:checked
    + .terms-label
    .checkbox-tick {
    stroke-dashoffset: 0;
  }
`;
