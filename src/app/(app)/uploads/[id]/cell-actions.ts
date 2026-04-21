'use server';

import { updateCell } from './actions';

export async function updateCellAction(input: Parameters<typeof updateCell>[0]) {
  return await updateCell(input);
}
