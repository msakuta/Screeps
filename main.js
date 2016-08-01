var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRanger = require('role.ranger');
var stats = require('stats')

function tryCreateCreepInt(role, priority, bodyCandidates){
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

function tryCreateCreep(role, priority){
    return tryCreateCreepInt(role, priority, [
        //[WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
        //[WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],
        [WORK,WORK,CARRY,CARRY,MOVE,MOVE],
        [WORK,WORK,CARRY,MOVE,MOVE],
        [WORK,CARRY,CARRY,MOVE,MOVE],
        [WORK,CARRY,MOVE]
    ])
}

function logStats(){
    var energy = 0, energyCapacity = 0
    var storedEnergy = 0, storedEnergyCapacity = 0
    for(let i in Game.rooms){
        let r = Game.rooms[i]
        energy += r.energyAvailable
        energyCapacity += r.energyCapacityAvailable

        let containers = r.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_CONTAINER}})
        for(let j = 0; j < containers.length; j++){
            storedEnergy += containers[j].store.energy
            storedEnergyCapacity += containers[j].storeCapacity
        }
    }

    var historyLength = 1000

    if(Memory.energyHistory === undefined)
        Memory.energyHistory = []
    Memory.energyHistory.push(energy)
    while(historyLength < Memory.energyHistory.length)
        Memory.energyHistory.splice(0,1)

    if(Memory.storedEnergyHistory === undefined)
        Memory.storedEnergyHistory = []
    Memory.storedEnergyHistory.push(storedEnergy)
    while(historyLength < Memory.storedEnergyHistory.length)
        Memory.storedEnergyHistory.splice(0,1)
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
            var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(closestHostile) {
                tower.attack(closestHostile);
            }
            else if(tower.energyCapacity / 2 < tower.energy){
                var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => {
                        if(s instanceof StructureWall){
                            if(41 <= s.pos.x)
                                return false
                            return s.hits < 30000
                        }
                        else if(s instanceof StructureRoad)
                            return s.hits < 4000
                        else
                            return s.hits < s.hitsMax
                    }
                });
                if(closestDamagedStructure) {
                    tower.repair(closestDamagedStructure);
                }
            }

        }
    }

    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');

    if(harvesters.length < 2 + 1) {
        tryCreateCreep('harvester')
    }

    var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');

    if(builders.length < 3) {
        tryCreateCreep('builder', Game.rooms.E49S14.controller.level)
    }

    var rangers = _.filter(Game.creeps, (creep) => creep.memory.role == 'ranger');

    if(rangers.length < 2) {
        tryCreateCreepInt('ranger', 0, [[RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE]])
    }

    var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    var maxUpgraders = 3;
    if(Memory.stats && 0 < Memory.stats.restingCreeps)
        maxUpgraders += Memory.stats.restingCreeps;
    if(1600 < Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1])
        maxUpgraders += 3;

    if(upgraders.length < maxUpgraders) {
        tryCreateCreep('upgrader',4)
    }


    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if(creep.memory.role === 'ranger')
            roleRanger.run(creep)
        if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
    }

    logStats()

    Memory.lastTick = Game.time
}
