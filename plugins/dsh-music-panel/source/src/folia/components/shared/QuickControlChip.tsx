import React from 'react';

// src/render/folia/components/shared/QuickControlChip.tsx
// Folia's background entries declare quick controls for its player panel. The plugin
// selects backgrounds from its own sheet, so the declarations stay in the entries but
// render nothing here.

export const QuickControlChip = (_props: unknown) => null;

export const QuickControlToggle = (_props: unknown) => null;

export const cycleValue = <T,>(values: readonly T[], current: T): T => {
    const index = values.indexOf(current);
    return values[(index + 1) % values.length] ?? values[0];
};

export default QuickControlChip;
