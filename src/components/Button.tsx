import type { ButtonHTMLAttributes } from 'react';

type Variant = 'green' | 'blue' | 'red' | 'white';

const VARIANTS: Record<Variant, string> = {
  green: 'border-0 border-b-4 bg-green border-green-dark text-white',
  blue: 'border-0 border-b-4 bg-blue border-blue-dark text-white',
  red: 'border-0 border-b-4 bg-red border-red-dark text-white',
  white: 'border-2 border-b-4 bg-white border-line text-blue',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean };

/** Bouton « 3D » : bordure basse épaisse, qui s'écrase au clic. */
export default function Button({ variant = 'green', full, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={[
        'rounded-xl2 px-5 py-3 text-base font-bold uppercase tracking-wide transition-colors duration-150',
        'active:translate-y-[2px] active:border-b-2',
        'disabled:cursor-not-allowed disabled:border-[#CFCFCF] disabled:bg-line disabled:text-[#AFAFAF]',
        'disabled:active:translate-y-0 disabled:active:border-b-4',
        VARIANTS[variant],
        full ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    />
  );
}
