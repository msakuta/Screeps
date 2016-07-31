var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var stats = require('stats')

function tryCreateCreep(role, priority){
    var bodyCandidates = [
        [WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],
        [WORK,WORK,CARRY,CARRY,MOVE,MOVE],
        [WORK,WORK,CARRY,MOVE,MOVE],
        [WORK,CARRY,CARRY,MOVE,MOVE],
        [WORK,CARRY,MOVE]
    ];
    var maxCandidate = bodyCandidates.length - (priority || 0)
    for(var i = 0; i < maxCandidate; i++){
        var body = bodyCandidates[i];
        if(0 <= Game.spawns.Spawn1.canCreateCreep(body))
            break;
    }
    if(i === maxCandidate)
        return;
    var newName = Game.spawns['Spawn1'].createCreep(body, undefined, {role: role});
    var partsStr = ''
    for(var i = 0; i < body.length; i++)
        partsStr += body[i][0]
    console.log('Spawning new ' + role + ': ' + partsStr + ', name: ' + newName);
}


module.exports.loop = function () {

    if(Memory.lastTick < Game.time-1)
        console.log(Memory.lastTick + '-' + Game.time + ' CPU overdraft!')

    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            // console.log('Clearing non-existing creep memory:', name);
        }
    }

    // We need status report only infrequently
    if(Game.time % 10 === 0){
        stats.stats()
    }

    for(var name in Game.rooms){
        var room = Game.rooms[name]
        var towers = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}})
        for(var j = 0; j < towers.length; j++) {
            var tower = towers[j]
            var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax
            });
            if(closestDamagedStructure) {
                tower.repair(closestDamagedStructure);
            }

            var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(closestHostile) {
                tower.attack(closestHostile);
            }
        }
    }

    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');

    if(harvesters.length < 2) {
        tryCreateCreep('harvester')
    }

    var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');

    if(builders.length < 3) {
        tryCreateCreep('builder',1)
    }

    var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');

    if(upgraders.length < 3) {
        tryCreateCreep('upgrader',3)
    }


    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
    }

    Memory.lastTick = Game.time
}
