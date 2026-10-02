/** Native, disposable office props. Units are metres; +Z is the front. */
export function createOfficeFurnishings(THREE) {
  const colors = {
    cream: '#f4f5f3', paper: '#ffffff', wood: '#d9d4ca', paleWood: '#e4dfd6',
    mint: '#d7dfdf', mintDark: '#839495', apricot: '#d5d2c9', dark: '#444b47',
    soil: '#635247', coffee: '#5c4433', metal: '#87948b', light: '#fff1cb',
    brownLeather: '#a8adb0', leatherLight: '#d1d5d7', silver: '#adb3bb',
    silverLight: '#c3c7cc', cork: '#bd976f', blue: '#387b9d', green: '#668b5b',
    gold: '#ceaa4f', rust: '#bc7048', water: '#c4d6e2',
  };
  const group = name => {
    const g = new THREE.Group(); g.name = name; g.userData.officeProp = true; return g;
  };
  function context(name) {
    const root = group(name), materials = new Map();
    // Each returned prop owns fresh materials, so disposing one room cannot
    // invalidate materials retained by another room or the next build.
    return { root, material(key) {
      if (!materials.has(key)) {
        const m = new THREE.MeshStandardMaterial({
          color: colors[key] || key,
          roughness: key === 'metal' ? .46 : key.includes('Leather') || key === 'leatherLight' ? .60 : .76,
          metalness: key === 'metal' ? .18 : key.startsWith('silver') ? .12 : 0,
          ...(key === 'light' ? { emissive: colors.light, emissiveIntensity: .35 } : {}),
        });
        m.name = `${name}_${key}`; m.userData.reviewOwnedMaterial = true;
        materials.set(key, m);
      }
      return materials.get(key);
    }};
  }
  function add(c, name, geometry, color, x = 0, y = 0, z = 0, parent = c.root) {
    geometry.userData.reviewOwned = 'geometry';
    const mesh = new THREE.Mesh(geometry, c.material(color));
    mesh.name = name; mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.reviewOwned = 'geometry'; parent.add(mesh); return mesh;
  }
  function roundedGeometry(w, h, d, radius = .025) {
    const bevel = Math.min(radius * .28, d * .24, w * .06, h * .06);
    const a = w / 2 - bevel, b = h / 2 - bevel;
    const r = Math.min(radius, a, b), s = new THREE.Shape();
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b);
    s.quadraticCurveTo(a, -b, a, -b + r); s.lineTo(a, b - r);
    s.quadraticCurveTo(a, b, a - r, b); s.lineTo(-a + r, b);
    s.quadraticCurveTo(-a, b, -a, b - r); s.lineTo(-a, -b + r);
    s.quadraticCurveTo(-a, -b, -a + r, -b);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: d - 2 * bevel, bevelEnabled: true, bevelSize: bevel,
      bevelThickness: bevel, bevelSegments: 3, steps: 1, curveSegments: 6,
    });
    geo.translate(0, 0, -d / 2 + bevel); return geo;
  }
  const box = (c, name, w, h, d, color, x, y, z, parent, radius) =>
    add(c, name, roundedGeometry(w, h, d, radius), color, x, y, z, parent);
  const cylinder = (c, name, top, bottom, height, color, x, y, z, parent) =>
    add(c, name, new THREE.CylinderGeometry(top, bottom, height, 24), color, x, y, z, parent);
  function ellipsoid(c, name, sx, sy, sz, color, x, y, z, parent) {
    const mesh = add(c, name, new THREE.SphereGeometry(1, 18, 12), color, x, y, z, parent);
    mesh.scale.set(sx, sy, sz); return mesh;
  }
  function tube(c, name, from, to, radius, color, parent) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a), centre = a.clone().add(b).multiplyScalar(.5);
    const mesh = cylinder(c, name, radius, radius, direction.length(), color,
      centre.x, centre.y, centre.z, parent);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }
  function mug(c, x, y, z, color, parent = c.root, name = 'Mug') {
    cylinder(c, `${name}_Body`, .032, .029, .09, color, x, y + .045, z, parent);
    cylinder(c, `${name}_Coffee`, .027, .027, .003, 'coffee', x, y + .087, z, parent);
    const handle = add(c, `${name}_Handle`, new THREE.TorusGeometry(.022, .006, 8, 20),
      color, x + .036, y + .052, z, parent);
    handle.scale.set(.82, 1.12, 1);
  }
  function chair(c, name, x, z, angle, color) {
    const g = group(name); g.position.set(x, 0, z); g.rotation.y = angle; c.root.add(g);
    for (const dx of [-.115, .115]) for (const dz of [-.115, .115]) {
      cylinder(c, `${name}_Leg`, .013, .018, .335, 'wood', dx, .1675, dz, g);
    }
    box(c, `${name}_Seat`, .33, .07, .33, color, 0, .37, 0, g, .045);
    box(c, `${name}_Back`, .33, .29, .065, color, 0, .515, -.145, g, .05);
    return g;
  }

  function workstation(height=.3479, lead=false) {
    const c=context('White_workstation'),g=c.root,w=lead?1.01:.78,d=.36;
    box(c,'Desktop',w,.025,d,'paper',0,height-.0125,0,g,.014);
    box(c,'Desk_edge',w-.014,.006,d-.014,'silverLight',0,height-.029,0,g,.009);
    for(const side of [-1,1]){
      const x=side*(w/2-.065);
      box(c,'Leg_upright',.027,height-.05,.027,'silver',x,(height-.05)/2,-.12,g,.004);
      box(c,'Leg_foot',.034,.018,.29,'silver',x,.009,-.005,g,.005);
      box(c,'Leg_rail',.027,.022,.28,'silver',x,height-.039,-.005,g,.004);
    }
    box(c,'Cable_tray',w*.6,.042,.075,'silverLight',0,height-.055,-.11,g,.006);
    const x=w/2-.16;
    box(c,'Pedestal',.22,height-.07,.265,'cream',x,(height-.07)/2+.018,0,g,.012);
    for(let row=0;row<3;row++){
      const y=.052+row*(height-.08)/3;
      box(c,'Drawer_face',.204,(height-.09)/3-.004,.012,'paper',x,y,.143,g,.006);
      box(c,'Drawer_pull',.065,.008,.012,'metal',x,y+.018,.155,g,.003);
    }
    return g;
  }

  function deskAccessories(index = 0) {
    const c = context(`DeskAccessories_${index}`), g = c.root;
    g.userData.surfaceAnchorY = 0;
    box(c, 'Keyboard_Base', .255, .024, .09, 'cream', 0, .012, .13, g, .013);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 10; col++) {
      box(c, `Keyboard_Key_${row}_${col}`, .018, .005, .017,
        row === 2 && col > 2 && col < 7 ? 'mint' : 'paper',
        -.105 + col * .023, .0265, .106 + row * .024, g, .0025);
    }
    box(c, 'Mouse_Pad', .135, .006, .14, 'mint', .235, .003, .13, g, .018);
    ellipsoid(c, 'Mouse', .025, .013, .039, 'cream', .235, .019, .125);
    box(c, 'Mouse_Scroll', .004, .003, .012, 'metal', .235, .032, .119, g, .001);
    mug(c, -.255, 0, .11, index % 2 ? 'apricot' : 'mint');
    const documents = group('Document_Stack'); documents.position.set(.07, 0, -.105);
    documents.rotation.y = index % 2 ? -.12 : .10; g.add(documents);
    box(c, 'Document_Folder', .18, .006, .16, 'apricot', 0, .003, 0, documents, .009);
    for (let i = 0; i < 3; i++) {
      box(c, `Document_Sheet_${i}`, .165, .002, .15, 'paper', i * .002, .007 + i * .002, 0, documents, .002);
    }
    for (let i = 0; i < 4; i++) {
      box(c, `Document_Line_${i}`, .11 - i * .013, .0008, .003, 'paleWood',
        -.015, .0125, -.045 + i * .023, documents, .0004);
    }
    cylinder(c, 'Desk_Lamp_Base', .045, .047, .016, 'mint', -.245, .008, -.105);
    tube(c, 'Desk_Lamp_Stem', [-.245, .014, -.105], [-.245, .165, -.105], .007, 'metal');
    tube(c, 'Desk_Lamp_Arm', [-.245, .165, -.105], [-.19, .19, -.075], .007, 'metal');
    const shade = cylinder(c, 'Desk_Lamp_Shade', .022, .047, .05, 'mint', -.19, .171, -.075);
    shade.rotation.x = -.2;
    cylinder(c, 'Desk_Lamp_Diffuser', .039, .039, .006, 'light', -.19, .145, -.07);
    return g;
  }

  function storage() {
    const c = context('Storage_Print_Notice'), g = c.root;
    for (const x of [-.49, .49]) for (const z of [-.145, .145]) {
      cylinder(c, 'Storage_Foot', .023, .026, .055, 'wood', x, .0275, z);
    }
    box(c, 'File_Cabinet_Body', 1.1, .50, .38, 'cream', 0, .305, 0, g, .045);
    for (const x of [-.267, .267]) for (let row = 0; row < 2; row++) {
      box(c, `File_Drawer_${x}_${row}`, .51, .20, .023, row ? 'cream' : 'mint',
        x, .19 + row * .228, .202, g, .017);
      box(c, 'Drawer_Handle', .105, .015, .023, 'wood', x, .215 + row * .228, .226, g, .007);
    }
    box(c, 'Printer_Body', .33, .125, .26, 'cream', -.27, .6175, .005, g, .025);
    box(c, 'Printer_Scanner_Lid', .35, .019, .275, 'mint', -.27, .6895, .005, g, .011);
    box(c, 'Printer_Output_Slot', .22, .012, .008, 'dark', -.27, .589, .14, g, .003);
    box(c, 'Printer_Output_Paper', .185, .003, .075, 'paper', -.27, .58, .171, g, .003);
    box(c, 'Printer_Display', .06, .003, .035, 'dark', -.175, .701, .075, g, .003);
    cylinder(c, 'Printer_Button', .008, .008, .004, 'apricot', -.23, .702, .075);
    for (let i = 0; i < 4; i++) {
      box(c, `File_Binder_${i}`, .038, .15 + i % 2 * .018, .155,
        i % 2 ? 'apricot' : 'mint', .18 + i * .045, .63 + i % 2 * .009, .012, g, .006);
      box(c, `File_Label_${i}`, .019, .047, .002, 'paper', .18 + i * .045, .646, .091, g, .002);
    }
    for (const x of [-.07, .47]) {
      tube(c, 'Notice_Board_Support', [x, .55, -.20], [x, 1.18, -.20], .012, 'wood');
    }
    box(c, 'Notice_Board_Frame', .69, .53, .04, 'wood', .2, 1.02, -.207, g, .024);
    box(c, 'Notice_Board_Cork', .637, .477, .012, 'paleWood', .2, 1.02, -.181, g, .015);
    for (let i = 0; i < 4; i++) {
      const paper = box(c, `Notice_Paper_${i}`, i === 0 ? .17 : .13, .15, .004,
        i % 2 ? 'cream' : 'mint', .035 + i % 2 * .31, 1.12 - Math.floor(i / 2) * .20, -.17, g, .004);
      paper.rotation.z = i % 2 ? -.08 : .08;
      for (let line = 0; line < 3; line++) {
        box(c, `Notice_Text_${i}_${line}`, .085 - line * .012, .006, .001,
          'paleWood', -.008, .025 - line * .024, .003, paper, .0005);
      }
      ellipsoid(c, `Notice_Pin_${i}`, .0045, .0045, .0045, 'apricot',
        paper.position.x, paper.position.y + .054, -.164);
    }
    return g;
  }

  function meetingArea() {
    const c = context('Meeting_Area'), g = c.root;
    cylinder(c, 'Meeting_Table_Foot', .245, .255, .045, 'mint', 0, .0225, 0);
    cylinder(c, 'Meeting_Table_Pedestal', .095, .14, .535, 'cream', 0, .3125, 0);
    const top = cylinder(c, 'Meeting_Table_Round_Top', 1, 1, .07, 'paleWood', 0, .615, 0);
    top.scale.set(.58, 1, .39); g.userData.tableSurfaceY = .65;
    chair(c, 'Meeting_Chair_Left', -.78, 0, Math.PI / 2, 'mint');
    chair(c, 'Meeting_Chair_Right', .78, 0, -Math.PI / 2, 'apricot');
    chair(c, 'Meeting_Chair_Front', 0, .65, Math.PI, 'mint');
    chair(c, 'Meeting_Chair_Back', 0, -.65, 0, 'apricot');
    const centrePlant = plant(); centrePlant.name = 'Meeting_Table_Plant';
    centrePlant.scale.setScalar(.23); centrePlant.position.y = .65; g.add(centrePlant);
    box(c, 'Meeting_Notebook', .14, .012, .19, 'mint', -.28, .656, .045, g, .008);
    mug(c, .30, .65, -.06, 'cream', g, 'Meeting_Mug');
    for (const x of [-.25, .25]) {
      box(c, 'Whiteboard_Foot', .07, .035, .22, 'wood', x, .0175, -.95, g, .014);
      tube(c, 'Whiteboard_Post', [x, .035, -.95], [x, 1.13, -.95], .011, 'metal');
    }
    box(c, 'Meeting_Whiteboard_Frame', .72, .44, .038, 'wood', 0, .98, -.95, g, .025);
    box(c, 'Meeting_Whiteboard_Surface', .668, .388, .010, 'paper', 0, .98, -.925, g, .016);
    box(c, 'Meeting_Whiteboard_Tray', .40, .021, .065, 'mint', 0, .756, -.909, g, .006);
    for (let i = 0; i < 3; i++) {
      box(c, `Meeting_Whiteboard_Memo_${i}`, .115, .115, .004,
        i % 2 ? 'apricot' : 'mint', -.21 + i * .21, 1.046, -.917, g, .005);
      box(c, `Meeting_Whiteboard_Note_${i}`, .085, .008, .001,
        'mintDark', -.21 + i * .21, 1.064, -.914, g, .001);
    }
    box(c, 'Whiteboard_Marker', .088, .012, .013, 'dark', -.10, .773, -.897, g, .004);
    return g;
  }

  function lounge() {
    const c = context('Lounge_Coffee_Area'), g = c.root;
    for (const x of [-.51, .51]) for (const z of [-.46, -.10]) {
      cylinder(c, 'Sofa_Foot', .027, .033, .09, 'wood', x, .045, z);
    }
    box(c, 'Sofa_Base', 1.28, .20, .55, 'brownLeather', 0, .19, -.28, g, .065);
    box(c, 'Sofa_Seat_Left', .535, .12, .42, 'brownLeather', -.285, .32, -.245, g, .047);
    box(c, 'Sofa_Seat_Right', .535, .12, .42, 'brownLeather', .285, .32, -.245, g, .047);
    box(c, 'Sofa_Back', 1.26, .36, .145, 'brownLeather', 0, .46, -.50, g, .055);
    for (const x of [-.635, .635]) {
      box(c, 'Sofa_Arm', .16, .285, .54, 'leatherLight', x, .35, -.28, g, .065);
    }
    const cushion = box(c, 'Sofa_Cream_Cushion', .22, .23, .075, 'cream', -.40, .45, -.37, g, .045);
    cushion.rotation.z = -.16; cushion.rotation.x = -.12;
    const table = cylinder(c, 'Lounge_Table_Top', 1, 1, .045, 'paleWood', -.08, .2275, .43);
    table.scale.set(.44, 1, .25);
    for (const x of [-.31, .15]) for (const z of [.31, .55]) {
      cylinder(c, 'Lounge_Table_Leg', .016, .022, .205, 'wood', x, .1025, z);
    }
    box(c, 'Lounge_Magazine', .15, .007, .19, 'mint', -.19, .2535, .43, g, .006);
    mug(c, .16, .25, .43, 'apricot', g, 'Lounge_Mug');
    const x = .96, z = -.28;
    for (const dx of [-.15, .15]) for (const dz of [-.12, .12]) {
      cylinder(c, 'Coffee_Station_Foot', .02, .025, .055, 'wood', x + dx, .0275, z + dz);
    }
    box(c, 'Coffee_Station_Cabinet', .43, .57, .35, 'cream', x, .34, z, g, .034);
    box(c, 'Coffee_Station_Door', .365, .46, .023, 'mint', x, .345, z + .187, g, .018);
    box(c, 'Coffee_Station_Handle', .075, .014, .022, 'wood', x, .515, z + .210, g, .006);
    box(c, 'Coffee_Station_Counter', .47, .04, .40, 'paleWood', x, .645, z, g, .024);
    box(c, 'Coffee_Machine_Body', .23, .21, .235, 'mintDark', x + .045, .77, z - .015, g, .035);
    box(c, 'Coffee_Machine_Front', .175, .14, .016, 'cream', x + .045, .79, z + .11, g, .012);
    cylinder(c, 'Coffee_Machine_Button', .012, .012, .006, 'apricot', x + .092, .844, z + .122).rotation.x = Math.PI / 2;
    box(c, 'Coffee_Machine_Spout', .036, .023, .039, 'metal', x + .045, .804, z + .13, g, .006);
    box(c, 'Coffee_Machine_Drip_Tray', .14, .013, .075, 'dark', x + .045, .68, z + .13, g, .006);
    mug(c, x + .045, .687, z + .13, 'cream', g, 'Coffee_Station_Cup');
    return g;
  }

  function plant() {
    const c = context('Office_Plant'), g = c.root;
    cylinder(c, 'Plant_Pot', .105, .075, .17, 'apricot', 0, .085, 0);
    const rim = add(c, 'Plant_Pot_Rim', new THREE.TorusGeometry(.097, .010, 8, 28), 'cream', 0, .163, 0);
    rim.rotation.x = Math.PI / 2;
    cylinder(c, 'Plant_Soil', .085, .085, .012, 'soil', 0, .163, 0);
    const stems = [
      [[0, .165, 0], [-.04, .54, .015]],
      [[0, .165, 0], [.065, .47, -.015]],
      [[0, .165, 0], [-.055, .38, -.045]],
    ];
    stems.forEach(([a, b], i) => tube(c, `Plant_Stem_${i}`, a, b, .0045, 'mintDark'));
    const leaves = [
      [-.045, .515, .018, -.45], [.03, .475, .015, .65],
      [-.095, .425, -.005, -.85], [.105, .405, -.015, .70],
      [-.09, .335, -.045, -.85], [.04, .315, .045, .8],
      [-.012, .585, .012, -.18], [.073, .485, -.025, .30],
    ];
    leaves.forEach(([x, y, z, rotation], i) => {
      const leaf = ellipsoid(c, `Plant_Leaf_${i}`, .034, .077, .013,
        i % 2 ? 'mint' : 'mintDark', x, y, z);
      leaf.rotation.z = rotation; leaf.rotation.y = i * .63;
    });
    return g;
  }

  function ceilingFixture() {
    const c = context('Ceiling_Pendant'), g = c.root;
    const dome = add(c, 'Ceiling_Shade', new THREE.SphereGeometry(.23, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      'cream', 0, .028, 0);
    dome.scale.y = .50;
    cylinder(c, 'Ceiling_Shade_Rim', .23, .23, .028, 'mint', 0, .014, 0);
    cylinder(c, 'Ceiling_Warm_Diffuser', .212, .212, .009, 'light', 0, .0045, 0);
    cylinder(c, 'Ceiling_Pendant_Stem', .006, .006, .055, 'metal', 0, .1665, 0);
    cylinder(c, 'Ceiling_Mount', .043, .043, .016, 'cream', 0, .202, 0);
    g.userData.localCeilingAnchorY = .21; return g;
  }

  /** Parts from the previous ivory/carpet/leather office, individually placeable. */
  function previousOfficeDetails() {
    const bookshelves = group('bookshelves');
    for (let shelf = 0; shelf < 2; shelf++) {
      const c = context(`Bookshelf_${shelf + 1}`), g = c.root;
      g.position.x = (shelf - .5) * .69; bookshelves.add(g);
      for (const x of [-.25, .25]) for (const z of [-.085, .085]) {
        cylinder(c, 'Bookshelf_Foot', .018, .022, .0575, 'brownLeather', x, .02875, z);
      }
      box(c, 'Bookshelf_Back', .60, .84, .018, 'paleWood', 0, .48, -.121, g, .008);
      for (const x of [-.28, .28]) box(c, 'Bookshelf_Side', .04, .84, .26, 'paleWood', x, .48, 0, g, .01);
      for (const y of [.075, .345, .615, .8825]) box(c, 'Bookshelf_Board', .56, .035, .26, 'paleWood', 0, y, 0, g, .009);
      const bookColors = ['blue', 'green', 'gold', 'rust', 'cream', 'blue', 'green', 'gold'];
      for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) {
        const height = .185 + (i + row + shelf) % 3 * .015;
        const x = -.193 + i * .055, bottom = .0925 + row * .27;
        box(c, `Book_${row}_${i}`, .044, height, .195, bookColors[(i + row + shelf) % 8],
          x, bottom + height / 2, .006, g, .004);
        box(c, `Book_Spine_Label_${row}_${i}`, .027, .033, .0015, 'paper',
          x, bottom + height * .64, .105, g, .002);
      }
    }

    const lockerC = context('lockers'), lockers = lockerC.root;
    for (const x of [-.64, .64]) for (const z of [-.12, .12]) {
      cylinder(lockerC, 'Locker_Foot', .025, .026, .04, 'dark', x, .02, z);
    }
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * .35;
      box(lockerC, `Locker_${i + 1}_Body`, .347, 1.06, .34, 'silver', x, .57, 0, lockers, .009);
      box(lockerC, `Locker_${i + 1}_Door`, .315, 1.0, .014, 'silverLight', x, .57, .178, lockers, .005);
      box(lockerC, `Locker_${i + 1}_Nameplate`, .075, .027, .003, 'dark', x, .943, .188, lockers, .002);
      box(lockerC, `Locker_${i + 1}_Handle`, .013, .085, .020, 'dark', x + .105, .59, .191, lockers, .004);
      for (let j = 0; j < 3; j++) box(lockerC, `Locker_${i + 1}_Vent_${j}`,
        .095, .004, .002, 'metal', x, .215 + j * .017, .187, lockers, .001);
    }

    const cabinetC = context('cabinet'), cabinet = cabinetC.root;
    for (const x of [-.27, .27]) for (const z of [-.12, .12]) {
      cylinder(cabinetC, 'Cabinet_Foot', .018, .022, .045, 'dark', x, .0225, z);
    }
    box(cabinetC, 'Separate_Cabinet_Body', .65, .455, .33, 'silver', 0, .2725, 0, cabinet, .017);
    for (let i = 0; i < 2; i++) {
      box(cabinetC, `Separate_Cabinet_Drawer_${i}`, .60, .193, .015, 'silverLight',
        0, .159 + i * .213, .174, cabinet, .009);
      box(cabinetC, `Separate_Cabinet_Handle_${i}`, .10, .014, .021, 'dark',
        0, .176 + i * .213, .19, cabinet, .004);
    }

    const waterC = context('watercooler'), watercooler = waterC.root;
    box(waterC, 'Watercooler_Body', .35, .54, .31, 'cream', 0, .27, 0, watercooler, .025);
    box(waterC, 'Watercooler_Dispenser_Recess', .19, .19, .008, 'silver', 0, .412, .158, watercooler, .018);
    cylinder(waterC, 'Water_Bottle_Neck', .036, .036, .036, 'water', 0, .545, -.015);
    cylinder(waterC, 'Water_Bottle', .086, .073, .216, 'water', 0, .665, -.015);
    cylinder(waterC, 'Water_Bottle_Cap', .078, .086, .026, 'water', 0, .787, -.015);
    for (const x of [-.045, .045]) {
      ellipsoid(waterC, 'Watercooler_Tap_Button', .011, .009, .009,
        x < 0 ? 'rust' : 'blue', x, .452, .172);
      tube(waterC, 'Watercooler_Tap', [x, .44, .173], [x, .421, .186], .004, 'metal');
    }
    box(waterC, 'Watercooler_Drip_Tray', .19, .012, .10, 'silverLight', 0, .332, .178, watercooler, .009);
    cylinder(waterC, 'Watercooler_Cup', .020, .017, .06, 'paper', .045, .368, .185);
    box(waterC, 'Watercooler_Lower_Door', .28, .245, .009, 'silverLight', 0, .142, .160, watercooler, .009);

    const clockC = context('wallclock'), wallclock = clockC.root;
    wallclock.userData.wallItem = true;
    add(clockC, 'Clock_Face', new THREE.CircleGeometry(.104, 40), 'paper', 0, 0, .010);
    add(clockC, 'Clock_Rim', new THREE.TorusGeometry(.104, .007, 8, 40), 'dark', 0, 0, .010);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const tick = box(clockC, `Clock_Tick_${i}`, .004, i % 3 ? .010 : .015, .002, 'dark',
        Math.sin(angle) * .083, Math.cos(angle) * .083, .014, wallclock, .001);
      tick.rotation.z = -angle;
    }
    for (const [name, length, angle] of [['Hour', .052, -Math.PI / 3], ['Minute', .075, Math.PI / 3]]) {
      const hand = box(clockC, `Clock_${name}_Hand`, .004, length, .003, 'dark',
        Math.sin(angle) * length / 2, Math.cos(angle) * length / 2, .019, wallclock, .001);
      hand.rotation.z = -angle;
    }
    ellipsoid(clockC, 'Clock_Hand_Pin', .005, .005, .004, 'dark', 0, 0, .021);

    const corkC = context('corkboard'), corkboard = corkC.root;
    corkboard.userData.wallItem = true;
    box(corkC, 'Corkboard_Frame', .58, .41, .028, 'wood', 0, 0, 0, corkboard, .018);
    box(corkC, 'Corkboard_Cork', .53, .36, .009, 'cork', 0, 0, .018, corkboard, .012);
    for (let i = 0; i < 6; i++) {
      const x = -.175 + i % 3 * .175, y = .085 - Math.floor(i / 3) * .17;
      const note = box(corkC, `Corkboard_Note_${i}`, .125, .125, .003, i % 2 ? 'paper' : 'cream',
        x, y, .026, corkboard, .003);
      note.rotation.z = i % 2 ? -.06 : .06;
      for (let line = 0; line < 3; line++) box(corkC, `Corkboard_Note_Line_${i}_${line}`,
        .080 - line * .01, .004, .001, 'paleWood', -.004, .02 - line * .024, .0025, note, .0005);
      ellipsoid(corkC, `Corkboard_Pin_${i}`, .005, .005, .004,
        i % 2 ? 'rust' : 'blue', x, y + .044, .032);
    }

    const calendarC = context('calendar'), calendar = calendarC.root;
    calendar.userData.wallItem = true;
    box(calendarC, 'Calendar_Paper', .24, .31, .016, 'paper', 0, 0, 0, calendar, .008);
    box(calendarC, 'Calendar_Header', .24, .056, .007, 'rust', 0, .127, .012, calendar, .005);
    for (let i = 0; i < 4; i++) add(calendarC, `Calendar_Binding_${i}`,
      new THREE.TorusGeometry(.008, .002, 6, 12), 'metal', -.08 + i * .054, .149, .014);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
      const x = -.092 + col * .0306, y = .035 - row * .045;
      box(calendarC, `Calendar_Day_${row * 7 + col + 1}`, .025, .033, .002,
        col === 0 ? 'cream' : 'paper', x, y, .010, calendar, .002);
      box(calendarC, `Calendar_Date_Mark_${row}_${col}`, .008, .006, .001,
        col === 0 ? 'rust' : col === 6 ? 'blue' : 'metal', x, y + .005, .012, calendar, .0008);
    }

    const lampC = context('floorlamp'), floorlamp = lampC.root;
    cylinder(lampC, 'Floor_Lamp_Base', .085, .09, .025, 'dark', 0, .0125, 0);
    tube(lampC, 'Floor_Lamp_Stem', [0, .025, 0], [0, .755, 0], .0075, 'silver');
    add(lampC, 'Floor_Lamp_Shade', new THREE.CylinderGeometry(.105, .04, .145, 28, 1, true),
      'cream', 0, .8225, 0);
    const rim = add(lampC, 'Floor_Lamp_Rim', new THREE.TorusGeometry(.105, .005, 8, 28), 'cream', 0, .895, 0);
    rim.rotation.x = Math.PI / 2;
    cylinder(lampC, 'Floor_Lamp_Diffuser', .089, .089, .004, 'light', 0, .88, 0);
    return { bookshelves, lockers, cabinet, watercooler, wallclock, corkboard, calendar, floorlamp };
  }

  return { workstation, deskAccessories, storage, meetingArea, lounge, plant, ceilingFixture, previousOfficeDetails };
}
