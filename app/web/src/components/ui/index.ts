/**
 * index.ts — a porta de entrada da biblioteca de componentes.
 *
 * POR QUE UM BARRIL
 * Uma tela importa de `components/ui` e pronto, em vez de oito linhas de import
 * com caminhos relativos diferentes. Também é o que torna a biblioteca
 * INVENTARIÁVEL: este arquivo é a lista do que existe, e um componente que não
 * está aqui não faz parte do sistema.
 *
 * ⚠️ `_internal/` NÃO é reexportado de propósito. Os hooks de foco, dismiss e
 * ancoragem são a maquinaria dos overlays, não API pública — uma tela que os
 * usasse direto estaria construindo um overlay paralelo, fora do contrato de
 * acessibilidade do CP2.
 */

// --- primitivas -------------------------------------------------------------
export { Button, LinkButton, type ButtonProps, type VarianteBotao, type TamanhoBotao } from "./button";
export { Input, type InputProps } from "./input";
export { Textarea, type TextareaProps } from "./textarea";
export { Field, CLASSES_CONTROLE, type FieldProps, type AtributosDoControle } from "./field";
export { Checkbox, Radio, RadioGroup, type CheckboxProps, type RadioProps } from "./checkbox";
export { Switch, type SwitchProps } from "./switch";
export { Slider, type SliderProps } from "./slider";
export { Select, Combobox, type OpcaoSelect, type SelectProps, type ComboboxProps } from "./select";

// --- overlays ---------------------------------------------------------------
export { Dialog, DialogTitle, DialogDescription, DialogFooter, DialogClose, useDialog, type DialogProps } from "./dialog";
export { Drawer, DrawerHeader, DrawerBody, DrawerFooter, type DrawerProps } from "./drawer";
export { Popover, type PopoverProps, type PropsDeGatilho } from "./popover";
export { Tooltip, type TooltipProps } from "./tooltip";
export { DropdownMenu, ContextMenu, type ItemDeMenu, type DropdownMenuProps } from "./dropdown-menu";
export { ToastProvider, useToast, type TipoToast } from "./toast";

// --- layout e dados ---------------------------------------------------------
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Label,
  Separator,
  Skeleton,
  RegiaoCarregando,
  type CardProps,
} from "./card";
export { Tabs, type Aba, type TabsProps } from "./tabs";
export { Accordion, type SecaoAccordion } from "./accordion";
export { Table, type ColunaTabela, type TableProps } from "./table";
export { Badge, SeverityBadge, StatusBadge, ROTULO_SEVERIDADE, type Severidade, type TomBadge } from "./badge";
export { Progress, Avatar, type ProgressProps } from "./progress";
export { Breadcrumb, Pagination, ScrollArea, type ItemTrilha } from "./navigation";
export { EmptyState, ErrorState, type EmptyStateProps, type ErrorStateProps } from "./empty-state";
export { Alert, type AlertProps, type TomAlert } from "./alert";
