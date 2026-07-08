import type { WordCloudItem } from '../../data/dashboardTypes'

type WordCloudProps = {
  words: WordCloudItem[]
}

export function WordCloud({ words }: WordCloudProps) {
  return (
    <div className="flex min-h-[260px] flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 p-3 leading-none">
      {words.map((word) => (
        <span
          key={word.text}
          className="font-semibold"
          style={{ fontSize: `${word.size}px`, color: word.color }}
        >
          {word.text}
        </span>
      ))}
    </div>
  )
}
