export default function StoreTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="route-transition">{children}</div>;
}
