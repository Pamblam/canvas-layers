
/**
 * A class for managing text related properties for canvas rendering contexts
 */
class CanvasTextStyle{

	constructor(opts){
		this._fill_style = opts.fill_style || null;
		this._text_align = opts.text_align || null;
		this._base_line = opts.base_line || null;

		this._font_families = opts.font_family ? this.parseFamiliesString(opts.font_family) : [];
		this._font_size = opts.font_size || null;
		this._font_style = opts.font_style || null;
		this._font_variant = opts.font_variant || null;
		this._font_weight = opts.font_weight || null;
		
		if(opts.font) this.setFontShorthand(opts.font);
	}

	/**
	 * Set the style properties on the provided canvas rending context
	 * @param {type} ctx
	 * @returns {CanvasTextStyle}
	 */
	setContext(ctx){
		var font = this.getFontShorthand();
		ctx.font = font || undefined;
		ctx.fillStyle = this._fill_style || undefined;
		ctx.textAlign = this._text_align || undefined;
		ctx.textBaseline = this._base_line || undefined;
		return this;
	}

	/**
	 * Set the baseline
	 * @param {type} base_line
	 * @returns {CanvasTextStyle}
	 */
	setBaseLine(base_line){this._base_line=base_line; return this; }
	
	/**
	 * Get the baseline
	 * @returns {type}
	 */
	getBaseLine(){return this._base_line;}
	
	/**
	 * Set the text alignment property
	 * @param {type} fill_style
	 * @returns {CanvasTextStyle}
	 */
	setTextAlign(fill_style){this._text_align=fill_style; return this; }
	
	/**
	 * Get the text align proerty
	 * @returns {type}
	 */
	getTextAlign(){return this._text_align;}

	/**
	 * Set the fill style
	 * @param {type} fill_style
	 * @returns {CanvasTextStyle}
	 */
	setFillStyle(fill_style){this._fill_style=fill_style; return this;}
	
	/**
	 * Get the fill style
	 * @returns {type}
	 */
	getFillStyle(){return this._fill_style;}
	
	/**
	 * Set the font size
	 * @param {type} size
	 * @returns {CanvasTextStyle}
	 */
	setFontSize(size){ this._font_size = size; return this; }
	
	/**
	 * Get the font size
	 * @param {type} size
	 * @returns {font_family|type}
	 */
	getFontSize(size){ return this._font_size; }
	
	/**
	 * Set the font style
	 * @param {type} style
	 * @returns {CanvasTextStyle}
	 */
	setFontStyle(style){ this._font_style = style; return this; }
	
	/**
	 * Get the font style
	 * @returns {font_family|type}
	 */
	getFontStyle(){ return this._font_style; }
	
	/**
	 * Set the font variant
	 * @param {type} variant
	 * @returns {CanvasTextStyle}
	 */
	setFontVariant(variant){ this._font_variant = variant; return this; }
	
	/**
	 * Get the font variant
	 * @returns {type|font_family}
	 */
	getFontVariant(){ return this._font_variant; }
	
	/**
	 * Set the font family
	 * @param {type} font
	 * @returns {CanvasTextStyle}
	 */
	setFontFamily(font){this._font_families = this.parseFamiliesString(font); return this; }
	
	/**
	 * Get the font fmaily
	 * @returns {unresolved}
	 */
	getFontFamily(){return this._font_families.length ? this._font_families.map(f=>`"${f}"`).join(", ") : null;}

	/**
	 * Set the font shorthand property
	 * @param {type} font
	 * @returns {CanvasTextStyle}
	 */
	setFontShorthand(font){
		var regex = /^(normal|italic|oblique|initial|inherit)?\s*(normal|small-caps|initial|inherit)?\s*(normal|bold|bolder|lighter|number|initial|inherit)?\s*(medium|xx-small|x-small|small|large|x-large|xx-large|smaller|larger|(\d*)(cm|mm|in|px|pt|pc|em|ex|ch|rem|vw|vh|vmin|vmax|%)|initial|inherit)?\s*(.*)?$/;
		var [full, font_style, font_variant, font_weight, font_size, font_size_length, font_size_unit, font_family] = font.match(regex);
		this._font_families = font_family ? this.parseFamiliesString(font_family) : [];
		this._font_size = font_size || null;
		this._font_style = font_style || null;
		this._font_variant = font_variant || null;
		this._font_weight = font_weight || null;
		return this;
	}
	
	/**
	 * Get the font shorthand property
	 * @returns {String}
	 */
	getFontShorthand(){
		var buffer = [];
		if(this._font_style) buffer.push(this._font_style);
		if(this._font_variant) buffer.push(this._font_variant);
		if(this._font_weight) buffer.push(this._font_weight);
		if(this._font_size) buffer.push(this._font_size);
		var fam = this.getFontFamily();
		if(fam) buffer.push(fam);
		return buffer.join(' ');
	}

	/**
	 * Parses a string with possibly quoted font names into an array of unquoted strings.
	 * @param {type} family
	 * @returns {unresolved}
	 */
	parseFamiliesString(family){
		return family.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(fam=>{
			fam = fam.trim();
			if([`'`, `"`].includes(fam[0]) && fam[fam.length-1] == fam[0]){
				fam = fam.substr(1, fam.length-2);
			}
			return fam;
		}).filter(m=>!!m.trim());
	}
}