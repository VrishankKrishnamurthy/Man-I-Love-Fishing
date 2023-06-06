import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Cube, Axis_Arrows, Textured_Phong, Square} = defs

export class Fishing extends Scene {
    /**
     *  **Base_scene** is a Scene that can be added to any display canvas.
     *  Setup the shapes, materials, camera, and lighting here.
     */
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();
        
        this.shapes = {
            box_1: new Cube(),
            box_2: new Cube(),
            axis: new Axis_Arrows(),
            plane: new Square(),
            raft: new Shape_From_File("assets/raft.obj"),
            text: new Text_Line(15),
            Island: new Shape_From_File("assets/island.obj"),
            Shipwreck: new Shape_From_File("assets/shipwreck.obj")
        }

        this.materials = {
            phong: new Material(new Textured_Phong(), {
                color: hex_color("#ffffff"),
            }),
            ocean: new Material(new Texture_Scroll_X(), {
                color: hex_color("#ffffff"),
                ambient: 0.5, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/water.png")
            }),
            wood: new Material(new defs.Fake_Bump_Map(1), {
                color: color(0.643, 0.455, 0.286, 1),
                ambient: 0.4,
                diffusivity: 0.25,
                specularity: 0.25,
                texture: new Texture("assets/wood.jpg"),
            }),
            text_image: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/text.png")
            }),
            island: new Material(new defs.Textured_Phong(1), {
               ambient: 1,
               texture: new Texture("assets/islandAtlas.png")
            }),
            shipwreck: new Material(new defs.Textured_Phong(1), {
                ambient: 1,
                texture: new Texture("assets/shipwreckAtlas.png")
            }),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 25, 15), vec3(0, 0, 0), vec3(0, 1, 0));

        this.key = null;
        this.speed = 0;
        this.max_speed = .05;
        this.boatRad = .5;
        this.initial_boat_transform = Mat4.identity().times(Mat4.translation(0, -.32, 15)).times(Mat4.scale(.5, .5, .5)).times(Mat4.rotation(Math.PI / 2, 0, 1, 0)).times(Mat4.translation(0, 1, 0));
        this.rotation = Mat4.identity();
        this.mapSize = 30;
        this.livesLeft = 3;

        // Generating Obstacle Positions
        this.numIslands = 8;
        this.numShipwrecks = 8;
        this.obstacleRad = 1;

        this.obstacleMat = [];
        let boundsMultiplier = .9;
        while (this.obstacleMat.length < this.numIslands + this.numShipwrecks) {
            let x = Math.floor(Math.random() * 2 * boundsMultiplier * this.mapSize) - boundsMultiplier * this.mapSize;
            let z = Math.floor(Math.random() * 2 * boundsMultiplier * this.mapSize) - boundsMultiplier * this.mapSize;
            let newPos = true;

            // Checking generated positions aren't too close to an existing obstacle
            for (let i = 0; i < this.obstacleMat.length; i++) {
                if (Math.sqrt((this.obstacleMat[i][0][3] - x) ** 2 + (this.obstacleMat[i][2][3] - z) ** 2) <= 8) {
                    newPos = false;
                    break;
                }
            }

            // Use position to build matrix transformation for obstacle, push to array
            if(newPos) {
                this.obstacleMat.push(Mat4.translation(x, .8, z).times(Mat4.rotation(Math.random() * 6 * Math.PI, 0, 1, 0)).times(Mat4.identity()));
            }
        }
    }
    
    make_control_panel() {
        // TODO:  Implement requirement #5 using a key_triggered_button that responds to the 'c' key.
    }

    drawObstacles(context, program_state) {
        // Iterate through obstacle array to draw
        for (let i = 0; i < this.numIslands + this.numShipwrecks; i++) {
            if(i<this.numIslands) // first few stored obstacles are islands
                this.shapes.Island.draw(context, program_state, Mat4.translation(0, 0.5, 0).times(this.obstacleMat[i]), this.materials.island);
            else if(this.obstacleMat[i][1][3] > 0) // rest are shipwrecks. check if shipwreck has been sunk
                this.shapes.Shipwreck.draw(context, program_state, this.obstacleMat[i], this.materials.shipwreck);
        }
    }

    checkObstacleCollisions(objPos) {
        for(let i = 0; i < this.numIslands + this.numShipwrecks; i++) {
            if(this.twoDimensionalCollision(objPos, this.boatRad, [this.obstacleMat[i][0][3], 0, this.obstacleMat[i][2][3]], this.obstacleRad)) {
                if (i < this.numIslands)
                    this.livesLeft -= 3; // hitting islands will end game
                else if(this.obstacleMat[i][1][3] > 0){
                    this.obstacleMat[i][1][3] = 0; // do not draw shipwreck again, shipwrecks hit will 'sink'
                    this.livesLeft -= 1; // hitting ships only take 1 life
                }
                return true;
            }
        }
        return false;
    }

    // Simple Bounding Sphere collision given object transforms and assigned radii
    twoDimensionalCollision(transform1, r1, transform2, r2) {
        return Math.sqrt((transform1[0] - transform2[0])**2 + (transform1[2] - transform2[2])**2) < r1 + r2;
    }

    display(context, program_state) {
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        if (t == 0) {
            this.boat_transform = this.initial_boat_transform;
        }

        if(this.livesLeft <= 0) {
            //return;
        }

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());

            // Dont scroll with keys
            window.addEventListener("keydown", function(e) {
                if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
                    e.preventDefault();
                }
            }, false);
            
            // Move Boat if key pressed
            document.onkeydown = (e) => {
                e = e || window.event;
                if (e.key === "ArrowUp") {
                    this.key = e.key;
                    // Move the boat forward
                    if (this.speed < this.max_speed) {
                        this.speed += 0.001;  // Increase speed gradually
                    }
                }
                if (e.key === "ArrowDown") {
                    this.key = e.key;
                    // Move the boat backward
                    if (this.speed > -this.max_speed) {
                        this.speed -= 0.001;  // Decrease speed gradually
                    }
                }
                if (e.key === "ArrowLeft") {
                    this.key = e.key;
                    let rotationSpeed = 0.01 * Math.pow(.6, Math.abs(this.speed / this.max_speed));
                    this.boat_transform = this.boat_transform.times(Mat4.rotation(rotationSpeed, 0, 1, 0));
                    this.rotation = this.rotation.times(Mat4.rotation(rotationSpeed, 0, 1, 0));
                }
                if (e.key === "ArrowRight") {
                    this.key = e.key;
                    let rotationSpeed = 0.01 * Math.pow(.6, Math.abs(this.speed / this.max_speed));
                    this.boat_transform = this.boat_transform.times(Mat4.rotation(-rotationSpeed, 0, 1, 0));
                    this.rotation = this.rotation.times(Mat4.rotation(-rotationSpeed, 0, 1, 0));
                }
            };

            // Define the global camera and projection matrices, which are stored in program_state.
            //program_state.set_camera(this.initial_camera_location);
        }

        this.boat_transform = this.boat_transform.times(Mat4.translation(this.speed, 0, 0));

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 500);

        const light_position = vec4(10, 10, 10, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        let water_transform = Mat4.identity().times(Mat4.scale(this.mapSize,1,this.mapSize));

        this.shapes.plane.draw(context, program_state, water_transform, this.materials.ocean);
        this.drawObstacles(context, program_state);
        this.shapes.raft.draw(context, program_state, this.boat_transform, this.materials.wood);

        let angle = Math.acos(this.rotation[0][0]);
        if (this.rotation[0][2] < 0) angle = -(angle) + 2*Math.PI;
        
        let boat_position = [this.boat_transform[0][3], this.boat_transform[1][3], this.boat_transform[2][3]]
        let camera_transform = [vec3(boat_position[0] + 15 * Math.sin(angle), boat_position[1] + 5, boat_position[2] + 15 * Math.cos(angle)), vec3(boat_position[0] + 3 * Math.sin(angle), boat_position[1] + 5, boat_position[2] + 3 * Math.cos(angle)), vec3(0, 1, 0)];
        let desired = Mat4.look_at(camera_transform[0], camera_transform[1], camera_transform[2]);
        desired = desired.map((x, i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1));
        program_state.set_camera(desired);

        this.checkObstacleCollisions(boat_position);

        this.shapes.text.set_string(`${(100 * this.speed / this.max_speed).toFixed(0)}% Speed`, context.context);
        this.shapes.text.draw(context, program_state, this.boat_transform.times(Mat4.scale(.1, .5, .5)).times(Mat4.translation(0, 2, -20)).times(Mat4.rotation(3 * Math.PI / 2, 1, 0, 0)).times(Mat4.rotation(3 * Math.PI / 2, 0, 0, 1)), this.materials.text_image);

        this.shapes.text.set_string(`${this.livesLeft}`, context.context);
        this.shapes.text.draw(context, program_state, this.boat_transform.times(Mat4.scale(.1, .5, .5)).times(Mat4.translation(0, 4, -20)).times(Mat4.rotation(3 * Math.PI / 2, 1, 0, 0)).times(Mat4.rotation(3 * Math.PI / 2, 0, 0, 1)), this.materials.text_image);
    }
}


class Texture_Scroll_X extends Textured_Phong {
    // TODO:  Modify the shader below (right now it's just the same fragment shader as Textured_Phong) for requirement #6.
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            
            void main(){
                // Sample texture image
                float speed = 0.05;
                float factor = speed*mod(animation_time, 1.0/speed);
                vec2 scaled_tex_coord = vec2(f_tex_coord.x, f_tex_coord.y - factor);
                vec4 tex_color = texture2D( texture, f_tex_coord); // change f_tex_coord to scaled_tex_coord for movement
                
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}


class Texture_Rotate extends Textured_Phong {
    // TODO:  Modify the shader below (right now it's just the same fragment shader as Textured_Phong) for requirement #7.
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            void main(){
                // Sample the texture image in the correct place:
                vec4 tex_color = texture2D( texture, f_tex_coord );
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}

export class Shape_From_File extends Shape {
    // **Shape_From_File** is a versatile standalone Shape that imports
    // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {
        // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then((response) => {
                if (response.ok) return Promise.resolve(response.text());
                else return Promise.reject(response.status);
            })
            .then((obj_file_contents) => this.parse_into_mesh(obj_file_contents))
            .catch((error) => {
                this.copy_onto_graphics_card(this.gl);
            });
    }

    parse_into_mesh(data) {
        // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [],
            vertNormals = [],
            textures = [],
            unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split("\n");

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices) unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split("/");

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[(vertex[1] - 1 || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[(vertex[1] - 1 || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const { verts, norms, textures } = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {
        // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready) super.draw(context, program_state, model_transform, material);
    }
}

export class Text_Line extends Shape {
    // **Text_Line** embeds text in the 3D world, using a crude texture
    // method.  This Shape is made of a horizontal arrangement of quads.
    // Each is textured over with images of ASCII characters, spelling
    // out a string.  Usage:  Instantiate the Shape with the desired
    // character line width.  Then assign it a single-line string by calling
    // set_string("your string") on it. Draw the shape on a material
    // with full ambient weight, and text.png assigned as its texture
    // file.  For multi-line strings, repeat this process and draw with
    // a different matrix.
    
    constructor(max_size) {
        super("position", "normal", "texture_coord");
        this.max_size = max_size;
        var object_transform = Mat4.identity();
        for (var i = 0; i < max_size; i++) {    // Each quad is a separate Square instance:
            defs.Square.insert_transformed_copy_into(this, [], object_transform);
            object_transform.post_multiply(Mat4.translation(1.5, 0, 0));
        }
    }

    set_string(line, context) {
        // set_string():  Call this to overwrite the texture coordinates buffer with new
        // values per quad, which enclose each of the string's characters.
        this.arrays.texture_coord = [];
        for (var i = 0; i < this.max_size; i++) {
            var row = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) / 16),
                col = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) % 16);

            var skip = 3, size = 32, sizefloor = size - skip;
            var dim = size * 16,
                left = (col * size + skip) / dim, top = (row * size + skip) / dim,
                right = (col * size + sizefloor) / dim, bottom = (row * size + sizefloor + 5) / dim;

            this.arrays.texture_coord.push(...Vector.cast([left, 1 - bottom], [right, 1 - bottom],
                [left, 1 - top], [right, 1 - top]));
        }
        if (!this.existing) {
            this.copy_onto_graphics_card(context);
            this.existing = true;
        } else
            this.copy_onto_graphics_card(context, ["texture_coord"], false);
    }
}