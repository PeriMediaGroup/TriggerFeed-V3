export default function Icon({
  icon: IconComponent,
  size = 20,
  strokeWidth = 2,
  className = "",
  "aria-hidden": ariaHidden = true,
  ...props
}) {
  if (!IconComponent) return null;

  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={ariaHidden}
      {...props}
    />
  );
}