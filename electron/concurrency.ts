/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 10:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:40:00
 * @FilePath: \electron\concurrency.ts
 * @Description: 主进程并发工具：按固定上限并发处理列表并保持结果顺序
 */

// 按固定上限并发处理列表，结果按原下标写回，单项异常由调用方在 mapper 内处理
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }
  const size = Math.min(Math.max(1, limit), items.length)
  await Promise.all(Array.from({ length: size }, () => worker()))
  return results
}
