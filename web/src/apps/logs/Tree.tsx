import { useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NodeId } from './types';
import { NodeIcon } from './icons';
import { TREE, cx, findNode, nodeLabel, parentOf, type TreeNode } from './model';

/** The visible (expanded) nodes in display order, with their depth. */
const flatten = (expanded: Set<NodeId>, n: TreeNode = TREE, depth = 0, out: { node: TreeNode; depth: number }[] = []) => {
  out.push({ node: n, depth });
  if (n.children && expanded.has(n.id)) for (const c of n.children) flatten(expanded, c, depth + 1, out);
  return out;
};

/**
 * MMC's console tree: Event Viewer (Local) > Custom Views, Windows Logs, Applications and Services
 * Logs, Subscriptions. Click selects; the chevron or a double-click expands; arrow keys navigate
 * like a real TreeView (Right expands / enters, Left collapses / goes to the parent).
 */
export function ConsoleTree({ node, onSelect, expanded, onToggle }: { node: NodeId; onSelect: (id: NodeId) => void; expanded: Set<NodeId>; onToggle: (id: NodeId, open?: boolean) => void }) {
  const [focused, setFocused] = useState(false);
  const rows = flatten(expanded);

  const onKey = (e: KeyboardEvent) => {
    const i = rows.findIndex(r => r.node.id === node);
    const cur = findNode(node);
    if (!cur) return;
    const has = !!cur.children?.length;
    if (e.key === 'ArrowDown' && i < rows.length - 1) onSelect(rows[i + 1].node.id);
    else if (e.key === 'ArrowUp' && i > 0) onSelect(rows[i - 1].node.id);
    else if (e.key === 'Home') onSelect(rows[0].node.id);
    else if (e.key === 'End') onSelect(rows[rows.length - 1].node.id);
    else if (e.key === 'ArrowRight' && has) {
      if (!expanded.has(cur.id)) onToggle(cur.id, true);
      else onSelect(cur.children![0].id);
    } else if (e.key === 'ArrowLeft') {
      if (has && expanded.has(cur.id)) onToggle(cur.id, false);
      else {
        const p = parentOf(cur.id);
        if (p) onSelect(p.id);
      }
    } else return;
    e.preventDefault();
  };

  return (
    <div
      role="tree"
      tabIndex={0}
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="h-full overflow-auto os-scroll py-1 outline-none text-[12px]"
    >
      {rows.map(({ node: n, depth }) => {
        const has = !!n.children?.length;
        const open = expanded.has(n.id);
        const sel = n.id === node;
        return (
          <div
            key={n.id}
            role="treeitem"
            aria-selected={sel}
            aria-expanded={has ? open : undefined}
            onMouseDown={() => onSelect(n.id)}
            onDoubleClick={() => has && onToggle(n.id)}
            className={cx(
              'h-[22px] flex items-center pr-2 whitespace-nowrap cursor-default select-none',
              sel ? (focused ? 'bg-accent text-accent-on' : 'bg-control-hover text-t1') : 'text-t1 hover:bg-subtle',
            )}
            style={{ paddingLeft: 2 + depth * 14 }}
          >
            <span
              className="w-4 h-4 shrink-0 flex items-center justify-center opacity-80"
              onMouseDown={e => {
                if (!has) return;
                e.stopPropagation();
                onToggle(n.id);
              }}
            >
              {has && (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
            </span>
            <NodeIcon kind={n.icon} open={open} />
            <span className="ml-1.5 truncate">{nodeLabel(n.id)}</span>
          </div>
        );
      })}
    </div>
  );
}
