/**
 * dsh-workflow-lite — 下拉选择（单选）：一个输入框样子的触发块，点开是一张和别处菜单一样的浮层。
 *
 * 不用原生 `<select>`：原生下拉的列表由系统画，颜色、字号、圆角都跟不上主题。
 * 选中项带底色和钩；打开时焦点落在选中项上，上下键在项之间走，Esc / 点外面收起，选了收起并把焦点还给触发块。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/Select
 */
export declare function Select<V extends string>(props: {
    label: string;
    value: V;
    options: readonly {
        value: V;
        label: string;
    }[];
    onChange: (value: V) => void;
    className?: string;
    /** 触发块的 testid；每一项是 `${testId}-${value}`。 */
    testId?: string;
}): React.JSX.Element;
