export async function fetchAllPages(
  url,
  { pageSize = 200, signal, credentials = 'include', headers } = {}
) {
  const results = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const separator = url.includes('?') ? '&' : '?'
    const response = await fetch(`${url}${separator}page=${page}&page_size=${pageSize}`, {
      signal,
      credentials,
      headers,
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} (status ${response.status})`)
    }
    const data = await response.json().catch(() => [])
    if (Array.isArray(data)) {
      results.push(...data)
      break
    }
    const pageResults = data.results ?? data.data ?? data.items ?? []
    if (Array.isArray(pageResults)) {
      results.push(...pageResults)
    }

    const pagination = data.pagination ?? null
    const totalPagesValue = Number(
      pagination?.total_pages ?? data.total_pages ?? 0
    )
    if (totalPagesValue > 0) {
      totalPages = totalPagesValue
    } else if (
      typeof pagination?.total_items === 'number' ||
      typeof data.total_items === 'number' ||
      typeof data.count === 'number'
    ) {
      const totalItems =
        pagination?.total_items ?? data.total_items ?? data.count ?? results.length
      totalPages = Math.max(1, Math.ceil(Number(totalItems) / pageSize))
    } else {
      // If the API doesn't expose pagination metadata, assume a single page.
      break
    }

    page += 1
  }

  return results
}
