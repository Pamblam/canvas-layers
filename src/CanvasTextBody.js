
class CanvasTextBody{
	
	constructor(ctx, opts={}){
		this.ctx = ctx;
		this.lines = [];
		this.line_spacing = opts.line_spacing || 0;
		this.text_spacing = opts.text_spacing || 0;
		this.boundary_width = opts.boundary_width || 0;
	}
	
	addCharacter(char){
		if(char === "\n"){
			this.newLine();
		}else{
			var current_line = this.lastLine();
			current_line.addCharacter(char);
		}
	}
	
	/**
	 * Get the last line, create one if there aren't any.
	 * @returns {Array}
	 */
	lastLine(){
		if(!this.lines.length) this.lines.push(new CanvasTextLine(this.ctx, {
			text_spacing: this.text_spacing
		}));
		return this.lines[this.lines.length-1];
	}
	
	/**
	 * Adds a new line. 
	 * @param {type} addChar - use with false when forcing a new line due to a wordwrap
	 * @returns {undefined}
	 */
	newLine(addChar=true){
		var current_line = this.lastLine();
		var y = current_line.getHeight() + current_line.y + this.line_spacing;
		if(addChar) current_line.addCharacter("\n");
		this.lines.push(new CanvasTextLine(this.ctx, {
			text_spacing: this.text_spacing
		}));
	}
	
}