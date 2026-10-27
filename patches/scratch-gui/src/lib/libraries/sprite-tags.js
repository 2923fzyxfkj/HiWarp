import messages from './tag-messages.js';
import {MATERIAL_SYMBOL_STYLES} from '../hiwarp-material-symbols.js';

// HiWarp: 追加三个 Material Symbols 风格标签。标签文案直接内联，
// 不走 tag-messages.js，避免还要改 l10n 词条（缺词条时按 id 回退到 defaultMessage）。
const hiwarpMaterialSymbolTags = MATERIAL_SYMBOL_STYLES.map(({tag, label}) => ({
    tag,
    intlLabel: {
        id: `gui.spriteLibrary.tag.${tag}`,
        defaultMessage: label
    }
}));

export default [
    {tag: 'animals', intlLabel: messages.animals},
    {tag: 'people', intlLabel: messages.people},
    {tag: 'fantasy', intlLabel: messages.fantasy},
    {tag: 'dance', intlLabel: messages.dance},
    {tag: 'music', intlLabel: messages.music},
    {tag: 'sports', intlLabel: messages.sports},
    {tag: 'food', intlLabel: messages.food},
    {tag: 'fashion', intlLabel: messages.fashion},
    {tag: 'letters', intlLabel: messages.letters},
    ...hiwarpMaterialSymbolTags
];
