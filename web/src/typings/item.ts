export type ItemData = {
  name: string;
  label: string;
  stack: boolean;
  usable: boolean;
  close: boolean;
  count: number;
  description?: string;
  buttons?: string[];
  ammoName?: string;
  image?: string;
  width?: number;
  height?: number;
  weapon?: boolean;
  component?: boolean;
  type?: string;
  compatibleWeapons?: string[];
  sizeModifier?: [number, number];
};
