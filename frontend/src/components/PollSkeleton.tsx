export default function PollSkeleton() {
  return (
    <div className="poll-skel">
      <div className="skel-header">
        <div className="skel-title shimmer" />
        <div className="skel-meta shimmer" />
      </div>
      <div className="skel-options">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skel-option shimmer" />
        ))}
      </div>
      <div className="skel-footer">
        <div className="skel-bar shimmer" />
        <div className="skel-btn shimmer" />
      </div>
    </div>
  )
}
