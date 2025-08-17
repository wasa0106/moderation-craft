/**
 * Markdown - Markdownレンダリングコンポーネント
 */

'use client'

import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        components={{
        // 見出し
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mb-2 text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mb-2 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-medium mb-1 text-foreground">{children}</h3>
        ),
        
        // パラグラフ
        p: ({ children }) => (
          <p className="mb-2 text-sm text-foreground leading-relaxed">{children}</p>
        ),
        
        // リスト
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm text-foreground ml-2">{children}</li>
        ),
        
        // コード
        code: ({ className, children, ...props }) => {
          const isInline = !className
          if (isInline) {
            return (
              <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono text-foreground">
                {children}
              </code>
            )
          }
          return (
            <code
              className="block p-2 rounded bg-muted text-xs font-mono text-foreground overflow-x-auto"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="mb-2">{children}</pre>
        ),
        
        // リンク
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            {children}
          </a>
        ),
        
        // 引用
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/30 pl-3 my-2 text-muted-foreground">
            {children}
          </blockquote>
        ),
        
        // 強調
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        
        // 区切り線
        hr: () => <hr className="my-3 border-border" />,
        
        // テーブル
        table: ({ children }) => (
          <table className="w-full mb-2 text-sm">{children}</table>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border">{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-border last:border-0">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="text-left font-medium p-1 text-foreground">{children}</th>
        ),
        td: ({ children }) => (
          <td className="p-1 text-foreground">{children}</td>
        ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}