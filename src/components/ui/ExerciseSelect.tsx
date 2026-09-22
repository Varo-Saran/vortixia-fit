"use client";

import { Select } from "@/components/ui/Select";

interface ExerciseSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export function ExerciseSelect({ options, value, onChange, label }: ExerciseSelectProps) {
  return (
    <Select
      options={options.map((option) => ({ value: option, label: option }))}
      value={value}
      onValueChange={onChange}
      label={label}
      className="w-full min-w-0 flex-1 sm:max-w-72"
      size="compact"
    />
  );
}
