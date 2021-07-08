
/**
 * A representation of a line of text to be drawn on a canvas
 * @type type
 */
class CanvasTextLine{
	
	constructor(ctx, opts={}){
		this.ctx = ctx;
		this.y = opts.y || 0;
		this.width = opts.width || 0;
		this.index_break_pos = opts.index_break_pos || 0;
		this.chars = opts.chars ? opts.chars.map(char=>new CanvasTextChar(ctx, char)) : [];
		this.text_spacing = opts.text_spacing || 0;
	}
	
	calculateWidth(){
		
	}
	
	/**
	 * Add a character to the end of a line
	 * @param {type} char
	 * @returns {undefined}
	 */
	addCharacter(char){
		this.chars.push(new CanvasTextChar(ctx, {
			char: char,
			text_spacing: this.text_spacing,
			x: this.chars.length ? this.chars[this.chars.length-1].x + this.chars[this.chars.length-1].width : 0
		}));
	}
	
	/**
	 * Create a copy of the current object
	 * @returns {CanvasTextLine}
	 */
	clone(){ 
		return new CanvasTextLine(this.ctx, {
			width: this.width,
			index_break_pos: this.index_break_pos,
			chars: this.chars.map(char=>char.serialize()),
			y: this.y
		}); 
	}
	
	/**
	 * Return a copy of all the characters in this line with 
	 * corrected y coordinates to be relative to the line's ascent
	 * @param {type} ctx
	 * @returns {undefined}
	 */
	getChars(ctx){
		let line_ascent = this.getAscent(ctx);
		var chars = [];
		for(let n=0; n<this.chars.length; n++){
			let char = new CanvasTextChar(this.ctx, this.chars[n].serialize());
			var baseline_offset = line_ascent - char.ascent;
			char.y = this.y + baseline_offset + char.ascent;;
			char.x += char.bounding_left;
			chars.push(char);
		}
		return chars;
	}
	
	/**
	 * Calculate the line ascent
	 * @returns {undefined}
	 */
	getAscent(ctx){
		let line_text = this.chars.map(c=>c.char).join('');
		let line_metrics = ctx.measureText(line_text);
		return line_metrics.actualBoundingBoxAscent;
	}
	
	/**
	 * Calculate the line height as the vertical distance between lines, 
	 * not including any line spacing
	 * @param {type} ctx
	 * @returns {Number}
	 */
	getHeight(ctx){
		let line_text = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		ctx.save();
		ctx.textBaseline = 'top';
		var top = ctx.measureText(line_text).actualBoundingBoxAscent;
		ctx.textBaseline = 'bottom';
		var bottom = ctx.measureText(line_text).actualBoundingBoxAscent;
		ctx.restore();
		return bottom - top;
	}
	
}