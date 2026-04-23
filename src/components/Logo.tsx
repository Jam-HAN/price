interface Props {
  className?: string
  variant?: 'dark' | 'light'
}

export default function Logo({ className = 'w-8 h-8', variant = 'dark' }: Props) {
  const src = variant === 'light' ? '/logo-white.png' : '/logo.png';
  return <img src={src} alt="대박통신" className={className} />;
}
