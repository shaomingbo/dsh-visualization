import { useMemo, useState } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DataTableProps } from './types.ts'
import css from './DataTable.module.css'

const DEFAULT_PAGE_SIZE = 50

/**
 * Render an accessible, filterable, sortable, paginated table over string-only data.
 * No file download is offered because spreadsheet formula injection is possible.
 */
export function DataTable(props: DataTableProps) {
  const pageSize = props.pageSize ?? DEFAULT_PAGE_SIZE
  const [filter, setFilter] = useState('')
  const [sortColumn, setSortColumn] = useState<number | undefined>(undefined)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (filter.trim() === '') return props.rows
    const needle = filter.toLowerCase()
    return props.rows.filter(row => row.some(cell => cell.toLowerCase().includes(needle)))
  }, [props.rows, filter])

  const sorted = useMemo(() => {
    if (sortColumn === undefined) return filtered
    const col = sortColumn
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      return av < bv ? -dir : av > bv ? dir : 0
    })
  }, [filtered, sortColumn, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const start = currentPage * pageSize
  const pageRows = sorted.slice(start, start + pageSize)

  const toggleSort = (index: number) => {
    if (sortColumn === index) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(index)
      setSortDir('asc')
    }
    setPage(0)
  }

  if (props.error !== undefined) {
    return (
      <section className={css.frame} role="alert">
        <p>{props.error}</p>
        <CodeBlock code={props.rows.map(row => row.join('\t')).join('\n')} lang="csv" copyLabel={props.labels.empty} copiedLabel={props.labels.empty} />
      </section>
    )
  }

  if (props.columns.length === 0) {
    return <section className={css.frame} role="status"><p>{props.labels.empty}</p></section>
  }

  return (
    <section className={css.frame}>
      <header className={css.toolbar}>
        <input
          type="search"
          className={css.filter}
          placeholder={props.labels.filterPlaceholder}
          value={filter}
          onChange={(event) => { setFilter(event.target.value); setPage(0) }}
          aria-label={props.labels.filterPlaceholder}
        />
      </header>
      <div className={css.scroll}>
        <table className={css.table}>
          <thead>
            <tr>
              {props.columns.map((column, index) => (
                <th
                  key={index}
                  onClick={() => { toggleSort(index) }}
                  aria-sort={sortColumn === index ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={css.th}
                >
                  {column}
                  {sortColumn === index && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={props.columns.length} className={css.empty}>{props.labels.empty}</td></tr>
            ) : pageRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {props.columns.map((_, colIndex) => (
                  <td key={colIndex} className={css.td}>{row[colIndex] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <footer className={css.pagination}>
          <button type="button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1) }}>
            {props.labels.previousPage}
          </button>
          <span>{props.labels.page(currentPage + 1, totalPages)}</span>
          <button type="button" disabled={currentPage >= totalPages - 1} onClick={() => { setPage(currentPage + 1) }}>
            {props.labels.nextPage}
          </button>
        </footer>
      )}
    </section>
  )
}
