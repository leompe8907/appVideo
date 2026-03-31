export function Skeleton({ className = '', style, variant = 'block' }) {
  const v = variant || 'block';
  return <div className={`skeleton skeleton--${v} ${className}`.trim()} style={style} />;
}

export function SkeletonText({ className = '', style }) {
  return <Skeleton variant="text" className={className} style={style} />;
}

export function SkeletonCard({ className = '', style }) {
  return <Skeleton variant="card" className={className} style={style} />;
}

export default Skeleton;

