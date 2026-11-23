import React from 'react';
import {
  Box,
  Cpu,
  Factory,
  Layers,
  Bot,
  Thermometer,
  ArrowLeftRight,
} from 'lucide-react';

function KettleIcon({ size = 24, strokeWidth = 1.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 7h9l2 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L8 7Z" />
      <path d="M8 8 3 6l3 9M17 8h2a3 3 0 0 1 0 6h-1M7 22h12M10 4h5M12.5 2v2" />
    </svg>
  );
}
function GrinderIcon({ size = 24, strokeWidth = 1.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h12l-2 6H8L6 3ZM8 9h8v11H8V9ZM6 21h12M9 13h6M10 17h4" />
      <path d="M12 3V1M16 10h3v5h-3" />
    </svg>
  );
}

export const getDeviceIcon = (thing) => {
  const description =
    `${thing.thingId} ${thing.attributes?.type || ''} ${thing.attributes?.label || ''}`.toLowerCase();
  if (thing.features?.components?.properties?.thingIds?.length) return Layers;
  if (/kettle|ấm/.test(description)) return KettleIcon;
  if (/grinder|coffee|cà phê/.test(description)) return GrinderIcon;
  if (/robot/.test(description)) return Bot;
  if (/warehouse|factory/.test(description)) return Factory;
  if (/sensor|temperature/.test(description)) return Thermometer;
  if (/device|controller/.test(description)) return Cpu;
  return Box;
};

export default function TwinVisual({ thing = {}, compact = false }) {
  const Icon = getDeviceIcon(thing);
  return (
    <div
      className={`twin-visual${compact ? ' is-compact' : ''}`}
      aria-hidden="true"
    >
      <span className="physical-object">
        <Icon size={compact ? 22 : 29} strokeWidth={1.35} />
      </span>
      <ArrowLeftRight
        className="twin-connector"
        size={compact ? 14 : 19}
        strokeWidth={1.35}
      />
      <span className="digital-object">
        <Icon size={compact ? 22 : 29} strokeWidth={1.35} />
        <i />
      </span>
    </div>
  );
}
