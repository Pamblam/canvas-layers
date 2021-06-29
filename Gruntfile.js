module.exports = function(grunt) {
	
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		
		concat: {
			options: {
				banner: '/**\n * <%= pkg.name %> - v<%= pkg.version %>' +
						'\n * <%= pkg.description %>' +
						'\n * @author <%= pkg.author %>' +
						'\n * @website <%= pkg.homepage %>' +
						'\n * @license <%= pkg.license %>' +
						'\n */\n\n'
			},
			dist: {
				src: [
					'src/Canvas.js',
					'src/CanvasLayer.js',
					'src/CanvasLayerGroup.js',
					'src/DrawingCanvas.js',
					'src/CanvasFonts.js',
					'src/fonts-array.js',
					'src/CanvasKeyLogger.js',
					'src/TypingCanvas.js'
				],
				dest: 'canvas-layers.js',
			},
		},
		'string-replace': {
			source: {
				files: {
					"canvas-layers.js": "canvas-layers.js"
				},
				options: {
					replacements: [{
						pattern: /{{ VERSION }}/g,
						replacement: '<%= pkg.version %>'
					}]
				}
			},
			readme: {
				files: {
					"README.md": "README.md"
				},
				options: {
					replacements: [{
						pattern: /\d*\.\d*\.\d*/g,
						replacement: '<%= pkg.version %>'
					}]
				}
			},
			docs: {
				files: {
					"docs/index.html": "docs/index.html"
				},
				options: {
					replacements: [{
						pattern: `<div id="jsdoc-banner" role="banner">
        </div>`,
						replacement: '<img src=../logo.png>'
					}]
				}
			}
		},
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> - v<%= pkg.version %> */'
			},
			build: {
				src: 'canvas-layers.js',
				dest: 'canvas-layers.min.js'
			}
		}
	});
	
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-string-replace');
	grunt.loadNpmTasks('grunt-contrib-uglify-es');
	
	grunt.registerTask('update-version', 'Update version', function () {
		var pkg = grunt.file.readJSON('package.json');
		pkg.version = pkg.version.split(".");
		var subversion = pkg.version.pop();
		subversion++;
		pkg.version.push(subversion);
		pkg.version = pkg.version.join(".");
		grunt.file.write('package.json', JSON.stringify(pkg, null, 2));
	});
	
	grunt.registerTask('jsdoc', 'Generate docs', function () {
		const {exec} = require('child_process');
		var done = this.async();
		exec('./node_modules/.bin/jsdoc --template ./node_modules/\@sugarcrm/jsdoc-baseline/  --destination ./docs canvas-layers.js', (err, stdout, stderr) => {
			if (err) {
				console.log('Unable to generate docs.');
				console.error(err);
				return;
			}
			console.log(`stdout: ${stdout}`);
			console.log(`stderr: ${stderr}`);
			done();
		});
	});
	
	grunt.registerTask('build-font-list', 'Build font list', function () {
		
		const fs = require('fs');
		const readline = require('readline');
		const fonts_file = 'src/known-fonts.txt';
		const fonts_array_file = 'src/fonts-array.js';
		var done = this.async();
		
		fs.truncate(fonts_array_file, 0, function () {
			var written_fonts = [];
			const writer = fs.createWriteStream(fonts_array_file, {flags: 'a'});
			writer.write("CanvasFonts._native_fontlist = [\n");
			
			var rd = readline.createInterface({
				input: fs.createReadStream(fonts_file),
				console: false
			});

			rd.on('line', function (line) {

				// Ignore lines that start with #, and empty lines
				if(/^#/.test(line) || !line.trim()) return;

				var f = [];

				var note = line.match(/\(.*\)/);

				if (note) {
					var perens = note[0].match(/\((.*)\)/)[1];
					var trimmed = line.replace(note[0], '');
					f.push(perens.trim());
					f.push(trimmed.trim());
				} else {
					f.push(line);
				}

				f.forEach(fnt => {
					var perens = fnt.match(/\[.*\]/);
					if (perens) fnt = fnt.replace(perens[0], '').trim();

					if(!written_fonts.includes(fnt)){
						written_fonts.push(fnt);
						writer.write("\t'"+fnt+"',\n");
					}
				});

			});

			rd.on('close', function(){
				writer.write("];\n", "utf8", function(){
					console.log("closed...");
					done();
				});
			});
			
		});
		
	});
	
	grunt.registerTask('default', [
		'update-version',
		'build-font-list',
		'concat',
		'string-replace:source',
		'string-replace:readme',
		'uglify',
		// 'jsdoc',
		'string-replace:docs'
	]);
	
};