import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {injectIntl, intlShape, defineMessages} from 'react-intl';
import VM from 'scratch-vm';

import {getSpriteLibrary} from '../lib/libraries/tw-async-libraries';
import randomizeSpritePosition from '../lib/randomize-sprite-position';
import spriteTags from '../lib/libraries/sprite-tags';
import {
    MATERIAL_SYMBOL_STYLES,
    MATERIAL_SYMBOL_FILL_SUFFIX,
    buildMaterialSymbolItems,
    insertMaterialSymbol,
    loadMaterialSymbolsIndex
} from '../lib/hiwarp-material-symbols.js';

import LibraryComponent from '../components/library/library.jsx';

const messages = defineMessages({
    libraryTitle: {
        defaultMessage: 'Choose a Sprite',
        description: 'Heading for the sprite library',
        id: 'gui.spriteLibrary.chooseASprite'
    }
});

const MATERIAL_SYMBOL_TAGS = MATERIAL_SYMBOL_STYLES.map(({tag}) => tag);

// HiWarp: 填充切换的样式（只在这个库出现，没必要进 css module）。
// 刻意做得紧凑：标签栏宽度紧张，控件每省一点，标签就能多显示一个。
const fillBarStyle = {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '0.35rem',
    flex: '0 0 auto'
};
const fillSelectStyle = {
    minHeight: '1.9rem',
    borderRadius: '0.5rem',
    border: '1px solid rgba(145, 204, 214, 0.35)',
    background: 'rgba(20, 37, 48, 0.9)',
    color: '#eef5fa',
    padding: '0 0.35rem',
    fontSize: '0.82rem'
};

class SpriteLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect',
            'handleFillChange',
            'renderExtraControls'
        ]);
        this.state = {
            data: getSpriteLibrary(),
            iconItems: [],
            fill: false
        };
        // 清单只取一次，存在实例上而不是 state（避免把几千个名字塞进 React 状态）
        this.materialSymbolsIndex = null;
    }
    componentDidMount () {
        if (this.state.data.then) {
            this.state.data.then(data => this.setState({
                data
            }));
        }
        this.loadMaterialSymbols();
    }
    loadMaterialSymbols () {
        loadMaterialSymbolsIndex()
            .then(index => {
                this.materialSymbolsIndex = index;
                this.setState({
                    iconItems: buildMaterialSymbolItems(index, this.state.fill)
                });
            })
            .catch(error => {
                // 素材没生成时不能静默：否则表现成"选项卡点进去是空的"
                // eslint-disable-next-line no-console
                console.error('[HiWarp] Material Symbols 未能加载:', error);
            });
    }
    handleFillChange (event) {
        const fill = event.currentTarget.value === MATERIAL_SYMBOL_FILL_SUFFIX;
        this.setState(oldState => ({
            fill,
            iconItems: this.materialSymbolsIndex ? (
                buildMaterialSymbolItems(this.materialSymbolsIndex, fill)
            ) : oldState.iconItems
        }));
    }
    handleItemSelect (item) {
        if (item && item.hiwarpIcon) {
            insertMaterialSymbol(this.props.vm, item)
                .then(() => {
                    this.props.onActivateBlocksTab();
                })
                .catch(error => {
                    // eslint-disable-next-line no-console
                    console.error('[HiWarp] 图标插入失败:', error);
                });
            return;
        }

        // Randomize position of library sprite
        randomizeSpritePosition(item);
        this.props.vm.addSprite(JSON.stringify(item)).then(() => {
            this.props.onActivateBlocksTab();
        });
    }
    renderExtraControls (selectedTag) {
        if (MATERIAL_SYMBOL_TAGS.indexOf(selectedTag) === -1) {
            return null;
        }
        return (
            <div style={fillBarStyle}>
                <select
                    aria-label="图标填充"
                    title="图标填充"
                    style={fillSelectStyle}
                    value={this.state.fill ? MATERIAL_SYMBOL_FILL_SUFFIX : ''}
                    onChange={this.handleFillChange}
                >
                    <option value="">{'描边'}</option>
                    <option value={MATERIAL_SYMBOL_FILL_SUFFIX}>{'实心'}</option>
                </select>
            </div>
        );
    }
    render () {
        const spriteData = this.state.data.then ? null : this.state.data;
        const data = spriteData ? spriteData.concat(this.state.iconItems) : null;
        return (
            <LibraryComponent
                data={data}
                id="spriteLibrary"
                tags={spriteTags}
                title={this.props.intl.formatMessage(messages.libraryTitle)}
                removedTrademarks
                renderExtraControls={this.renderExtraControls}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

SpriteLibrary.propTypes = {
    intl: intlShape.isRequired,
    onActivateBlocksTab: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

export default injectIntl(SpriteLibrary);
