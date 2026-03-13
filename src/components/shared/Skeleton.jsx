export function ViewSkeleton() {
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* 프로젝트 헤더 스켈레톤 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            height: 36, flex: 1, borderRadius: 8,
            background: 'linear-gradient(90deg, #f5f3ef 25%, #ece8e1 50%, #f5f3ef 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }} />
        ))}
      </div>

      {/* 행 스켈레톤 */}
      {[...Array(3)].map((_, row) => (
        <div key={row} style={{ marginBottom: 16 }}>
          <div style={{
            height: 14, width: 120, borderRadius: 4, marginBottom: 10,
            background: '#ece8e1',
          }} />
          <div style={{ display: 'flex', gap: 12 }}>
            {[...Array(4)].map((_, col) => (
              <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...Array(2)].map((_, card) => (
                  <div key={card} style={{
                    height: 44, borderRadius: 6,
                    background: 'linear-gradient(90deg, #f5f3ef 25%, #ece8e1 50%, #f5f3ef 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    animationDelay: `${(row * 4 + col) * 0.1}s`,
                  }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '50vh', color: '#bbb', fontSize: 14,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7, background: '#1E293B',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 14, fontWeight: 700,
        fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
        marginRight: 10, animation: 'pulse 1.5s infinite',
      }}>R</div>
      로딩 중...
    </div>
  )
}
