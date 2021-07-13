
/**
 * A representation of a character of text to be drawn to canvas
 * @type type
 */
class CanvasTextChar{
	
	constructor(ctx, opts){
		this.ctx = ctx;
		this.char = opts.char || '';
		this.x = opts.x || 0;
		this.text_spacing = opts.text_spacing || 0;
		
		var measure_char = this.char;
		if(this.char === ' ') measure_char = '_';
		if(this.char === "\n") measure_char = '|'
		
		let metrics = ctx.measureText(measure_char);
		this.width = (Math.abs(metrics.actualBoundingBoxLeft) + Math.abs(metrics.actualBoundingBoxRight)) + this.text_spacing;
		this.height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
		this.ascent = metrics.actualBoundingBoxAscent;
		this.bounding_left = metrics.actualBoundingBoxLeft;
	}
	
	getBoundingBox(){
		return {
			x: this.x - this.bounding_left,
			y: this.y - this.ascent, 
			width: this.width, 
			height: this.height
		};
	}
	
	serialize(){
		return {
			char: this.char,
			x: this.x,
			text_spacing: this.text_spacing
		}
	}
	
}