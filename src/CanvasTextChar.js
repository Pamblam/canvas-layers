
/**
 * A representation of a character of text to be drawn to canvas
 * @type type
 */
class CanvasTextChar{
	
	constructor(ctx, opts){
		this.char = opts.char || '';
		this.x = opts.x || 0;
		this.y = opts.y || 0;
		this.text_spacing = opts.text_spacing || 0;
		
		this.line_no = opts.line_no || 1;
		this.line_pos = opts.line_pos || 1;
		
		var measure_char = this.char;
		if(this.char === ' ') measure_char = '_';
		if(this.char === "\n") measure_char = '|';
		
		let metrics = ctx.measureText(measure_char);
		this.width = (Math.abs(metrics.actualBoundingBoxLeft) + Math.abs(metrics.actualBoundingBoxRight)) + this.text_spacing;
		this.height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
		this.ascent = metrics.actualBoundingBoxAscent;
		this.bounding_left = metrics.actualBoundingBoxLeft;
	}
	
}