/**
 * dsh-workflow-lite — 「画布展示」：面板里一个开关加一行摘要，细项收在一张浮层里（{@link DisplayOptions}）。
 *
 * 开了之后资源卡在画布上变成一块展示区（见 Canvas 的展示卡与 ResourceDisplay）。
 * 面板里只留开关和「大 448×256 · 100% · 柔边镂空」这样一行，点「调整」浮出细项；画布上选中展示卡，
 * 标题行的齿轮打开同一张浮层，摆在卡片旁边（卡片往右下长大也碰不到它），改什么卡片当场跟着变。
 *
 * 细项分四组：内容（多项时才有）、大小（三档、宽高、缩放；图片多一个摆放）、外观（五张小样：跟随设置和四种样子，
 * 见 app/displayLook.ts；下面一个「隐藏标题」）、适配（展示的是文件时：写它的步骤的任务描述里带上卡片尺寸）。说明都收进提示里。
 * 实例视图里改的只是这个实例（和挪卡片一样进草稿栏，存的时候不通知模型）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/DisplaySettings
 */
import { type ResourceData, type ResourceView } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import { type Display } from '../../model/display.ts';
import { useFloat } from '../kit/useFloat.tsx';
/** 面板里那一行摘要：「大 448×256 · 100% · 柔边镂空」，没让模型适配时末尾带一句。 */
export declare function displaySummary(t: T, display: Display, file: boolean): string;
/**
 * 展示的细项（浮层的内容）。面板和画布上的齿轮共用；`items` 只有面板给（画布上的卡不知道资源里有哪几项）。
 */
export declare function DisplayOptions(props: {
    t: T;
    view: ResourceView;
    display: Display;
    /** 展示的是文件（才有「让模型适配」）。 */
    file: boolean;
    /** 展示的那一项的路径（日志、表格、文件夹有自己的「内容」一组）。 */
    path: string;
    /** 卡片读到的列名记在哪（{@link useTableHead}）。 */
    headKey: string;
    items?: {
        options: readonly {
            value: string;
            label: string;
        }[];
        onPick(index: number): void;
    };
    onChange(view: ResourceView): void;
}): React.JSX.Element;
/** 「调整」按钮 + 浮层，或画布卡片上的齿轮 + 浮层：同一套开关、摆位、收起规则（见 useFloat）。 */
export declare function useDisplayFloat<A extends HTMLElement>(beside?: React.RefObject<HTMLElement | null>, besideTop?: 'beside' | 'anchor'): ReturnType<typeof useFloat<A>>;
export declare function DisplaySettings(props: {
    t: T;
    /** 资源卡的 id（表格挑列要用卡片读到的列名）。 */
    node: string;
    data: ResourceData;
    onChange(view: ResourceView | undefined): void;
}): React.JSX.Element;
