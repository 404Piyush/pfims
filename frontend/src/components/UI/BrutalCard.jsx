import clsx from 'clsx';

// Brutalist data card — 2px ink border, offset solid shadow, no border-radius
// beyond a small chamfer. Designed for tables, lists and KPI strips where
// type-density matters more than polish.
export default function BrutalCard({
  as: Tag = 'div',
  children,
  hoverable = false,
  className,
  ...rest
}) {
  return (
    <Tag
      className={clsx(
        'relative bg-brutal-paper border-2 border-brutal-ink rounded-[3px]',
        'shadow-brutal',
        hoverable && 'transition-transform duration-150 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[10px_10px_0_0_#0a0a0a]',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
