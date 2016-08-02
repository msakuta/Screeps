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
        [WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
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
    var source = 0
    for(let i in Game.rooms){
        let r = Game.rooms[i]
        energy += r.energyAvailable
        energyCapacity += r.energyCapacityAvailable

        let containers = r.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE})
        for(let j = 0; j < containers.length; j++){
            storedEnergy += containers[j].store.energy
            storedEnergyCapacity += containers[j].storeCapacity
        }

        let sources = r.find(FIND_SOURCES)
        for(let j = 0; j < sources.length; j++)
            source += sources[j].energy
    }

    var historyLength = 1000
    function appendHistory(key, value){
        if(Memory[key] === undefined)
            Memory[key] = []
        Memory[key].push(value)
        while(historyLength < Memory[key].length)
            Memory[key].splice(0,1)
    }

    appendHistory('energyHistory', energy)
    appendHistory('storedEnergyHistory', storedEnergy)
    appendHistory('sourceHistory', source)
    appendHistory('cpuHistory', Game.cpu.getUsed())
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
                var damagedStructures = roleBuilder.findDamagedStructures(tower.room)
                if(0 < damagedStructures.length) {
                    damagedStructures.sort((a,b) => a.hits - b.hits)
                    tower.repair(damagedStructures[0]);
                }
            }

        }
    }

    roleHarvester.sortDistance()

    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');

    if(harvesters.length < 2 + 1) {
        tryCreateCreep('harvester')
    }

    var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');

    if(builders.length < 3) {
        tryCreateCreep('builder', Game.spawns.Spawn1.room.controller.level)
    }

    var rangers = _.filter(Game.creeps, (creep) => creep.memory.role == 'ranger');
    var maxRangers = 2;

    // If we see an enemy in the room, reinforce attack force.
    if(0 < Game.spawns.Spawn1.room.find(FIND_HOSTILE_CREEPS).length)
        maxRangers++

    if(rangers.length < 2) {
        tryCreateCreepInt('ranger', 0, [
            [RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE],
            [RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE]
        ])
    }

    var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    var maxUpgraders = 3;
    if(Memory.stats && 0 < Memory.stats.restingCreeps)
        maxUpgraders += Memory.stats.restingCreeps;
    if(1600 < Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1])
        maxUpgraders += 1;

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
