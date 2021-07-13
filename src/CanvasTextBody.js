
class CanvasTextBody{
	
	constructor(ctx, opts={}){
		this.ctx = ctx;
		this.chars = [];
		this.line_spacing = opts.line_spacing || 0;
		this.text_spacing = opts.text_spacing || 0;
		this.boundary_width = opts.boundary_width || 0;
		
		// The x, y position of the bounding box itself
		this.x = opts.x || 0;
		this.y = opts.y || 0;
	}
	
	appendChar(char_str){
		
		// Create an append character object to the chars array
		var char = new CanvasTextChar(this.ctx, {
			char: char_str, 
			text_spacing: this.text_spacing
		});
		this.chars.push(char);
		
		// Set the x, y, line_no, and line_pos properties
		this.setLastCharPosition();
	}
	
	// Get the x, y coordinates of the next character
	setLastCharPosition(){
		var char = this.chars[this.chars.length-1];
		var first_char_in_line = this.chars.length === 1;
		
		char.x = this.x;
		char.y = this.y;
		char.line_no = 1;
		char.line_pos = 1;
		
		// Print on new line when previous char is a linebreak character
		if(this.chars.length > 1){
			let prev_char = this.chars[this.chars.length-2];
			
			char.line_no = prev_char.line_no;
			char.line_pos = prev_char.char === "\n" ? 1 : prev_char.line_pos + 1;
			
			// If the last char is a line break, the next char needs to start a new line
			if(prev_char.char === "\n"){
				char.y = prev_char.y + this.getLineHeight() + this.line_spacing;
				char.line_no++;
				char.line_pos = 1;
				first_char_in_line = true;
			}else{
				char.x = prev_char.x + prev_char.width + prev_char.text_spacing;
				char.y = prev_char.y;
			}
		}
		
		// If we're on the first character of the line, increase the 
		// current x position by the width of the character, else shift 
		// the current character to the left to line up with the 
		// text alignment line
		if(!first_char_in_line){
			//console.log('spacing back', char.bounding_left, char.char);
			char.x -= char.bounding_left;
		}
		
		// If word wrap isn't turned off and line doesn't fit in boundary 
		// we need to find a safe place to wrap
		if(this.boundary_width !== 0 && char.x + char.width >= this.boundary_width){
			
			// Find where to add line break
			for(let i=this.chars.length; i--;){
				let c = this.chars[i];

				// We only need to look at the current line
				// and we need more than one character on the
				// current line to justify a wrap
				if(char.line_no !== c.line_no || i === 0 || char.line_no !== this.chars[i-1].line_no) break;

				if([' ', "\t", "-"].includes(c.char)){

					// Iterate back forward thru the array 
					// and reset the x and y of the offending chars
					for(let new_x = this.x; i<this.chars.length; i++){
						c = this.chars[i];
						c.x = new_x;
						c.y += this.getLineHeight();
						new_x += c.width + c.text_spacing;
						first_char_in_line = true;
					}

					break;
				}
			}
			
		}
		
	}
	
	/**
	 * Calculate the line height as the vertical distance between lines, 
	 * not including any line spacing
	 * @returns {Number}
	 */
	getLineHeight(){
		let line_text = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		this.ctx.save();
		this.ctx.textBaseline = 'top';
		var top = this.ctx.measureText(line_text).actualBoundingBoxAscent;
		this.ctx.textBaseline = 'bottom';
		var bottom = this.ctx.measureText(line_text).actualBoundingBoxAscent;
		this.ctx.restore();
		return bottom - top;
	}
}