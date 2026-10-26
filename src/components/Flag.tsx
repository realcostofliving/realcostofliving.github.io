interface Props {
  id: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Small SVG flag (flag-icons). EU-27 and euro area benchmarks use the EU flag. */
export default function Flag({ id, size = 'sm' }: Props) {
  const code = id === 'EU27' || id === 'EA' ? 'eu' : id.toLowerCase();
  return <span className={`fi fi-${code} flag flag-${size}`} aria-hidden="true" />;
}
