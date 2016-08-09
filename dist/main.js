var roleHarvester = require('role.harvester');
var roleAttacker = require('role.attacker');
var roleClaimer = require('role.claimer');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRanger = require('role.ranger');
var roleTransporter = require('role.transporter');
var stats = require('stats')

function tryCreateCreepInt(role, priority, bodyCandidates, spawn){
    spawn = spawn || Game.spawns.Spawn1
    var maxCandidate = bodyCandidates.length - (priority || 0)
    for(var i = 0; i < maxCandidate; i++){
        var body = bodyCandidates[i];
        if(0 <= spawn.canCreateCreep(body))
            break;
    }
    if(i === maxCandidate){
        return;
    }
    var newName = spawn.createCreep(body, undefined, {role: role});
    var partsStr = ''
    for(var i = 0; i < body.length; i++)
        partsStr += body[i][0]
    console.log('[' + spawn.name + '] Spawning new ' + role + ': ' + partsStr + ', name: ' + newName);
}

function tryCreateCreep(role, priority, spawn){
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
    ], spawn)
}

function calcStoredEnergy(room){
    var storedEnergy = 0, storedEnergyCapacity = 0
    let containers = room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE})
    for(let j = 0; j < containers.length; j++){
        storedEnergy += containers[j].store.energy
        storedEnergyCapacity += containers[j].storeCapacity
    }
    return [storedEnergy, storedEnergyCapacity]
}

function logStats(){
    var energy = 0, energyCapacity = 0
    var storedEnergy = 0, storedEnergyCapacity = 0
    var source = 0
    for(let i in Game.rooms){
        let r = Game.rooms[i]
        energy += r.energyAvailable
        energyCapacity += r.energyCapacityAvailable

        let stored = calcStoredEnergy(r)
        storedEnergy += stored[0]
        storedEnergyCapacity += stored[1]

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

    stats.resetCache()

    // We need status report only infrequently
    if(Game.time % 10 === 0){
        stats.stats()
        // Debug check for contents of total energy array cache
/*        let ss = ''
        for(let s in stats.totalEnergyCache){
            if(s !== 'time')
                ss += s + ' ' + stats.totalEnergyCache[s] + ', '
        }
        console.log('totalEnergyCache: ' + ss)*/
    }

    // Control turrets
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

    // Control links
    for(var name in Game.rooms){
        var room = Game.rooms[name]
        if(room.storage){
            let links = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_LINK}})
            for(var j = 0; j < links.length; j++) {
                let link = links[j]
                let range = link.pos.getRangeTo(room.storage)
                link.range = range
            }

            links.sort((a,b) => a.range - b.range)

            if(2 <= links.length){
                links[1].transferEnergy(links[0])
                // Cache sink and source flags to use for harvesters
                links[0].sink = true
                links[1].source = true
                //console.log('links sink: ' + links[0] + ', source: ' + links[1])
            }
            room.links = links
        }
    }


    roleHarvester.sortDistance()

    var bodyCosts = {
        [MOVE]: 50, [WORK]: 100, [CARRY]: 50, [ATTACK]: 80, [RANGED_ATTACK]: 150, [HEAL]: 250, [CLAIM]: 600, [TOUGH]: 10
    }

    function countBodyCost(creep, spawn){
        var ret = 0
        for(var i = 0; i < creep.body.length; i++)
            ret += bodyCosts[creep.body[i].type]
        return ret
    }

    // Spawn harvesters
    for(let key in Game.spawns){
        let spawn = Game.spawns[key]
        let harvesterCost = 0
        let harvesterCount = 0
        for(let i in Game.creeps){
            if(Game.creeps[i].memory.role === 'harvester' && Game.creeps[i].room === spawn.room){
                harvesterCost += countBodyCost(Game.creeps[i], spawn)
                harvesterCount++
            }
        }
        let energy = stats.totalEnergy(spawn.room)
        spawn.room.energy = energy // cache stats for later use
        //console.log('harvesterCost: ' + harvesterCost + ', energy: ' + energy[0] + '/' + energy[2])

        let sourceCount = spawn.room.find(FIND_SOURCES).length;

        if(harvesterCount < sourceCount + 1 && harvesterCost * 2 < energy[0] + energy[2]) {
            tryCreateCreep('harvester', 0, spawn)
        }
    }

    // There's no siple way to obtain number of controllers under the player's control
    var controllers = (() => {
        var ret = 0
        for(let k in Game.rooms){
            if(Game.rooms[k].controller && Game.rooms[k].controller.my)
                ret++
        }
        return ret
    })()

    var attackers = _.filter(Game.creeps, (creep) => creep.memory.role == 'attacker');
    var maxAttackers = (controllers < 2) * Math.min(3, Math.floor(Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1] / 5e4))

    if(attackers.length < maxAttackers) {
        tryCreateCreepInt('attacker', 0, [
            [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
            [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
        ])
    }

    var claimers = _.filter(Game.creeps, (creep) => creep.memory.role === 'claimer');
    // Let's stop generating claimers if maximum number of controllable rooms is reached.
    // Technically it may have benefit because claimers can also reserve, but we'll ignore it for now.
    var maxClaimers = controllers === Game.gcl.level ? 0 : Math.min(2, Math.floor(Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1] / 5e4))

    // Debug output
    //console.log('controllers: ' + controllers + ', gcl: ' + Game.gcl.level + ', maxClaimers: ' + maxClaimers)

    if(claimers.length < maxClaimers) {
        tryCreateCreepInt('claimer', 0, [
            [CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,MOVE,MOVE],
            [CLAIM,MOVE,MOVE],
        ])
    }

    // Spawn builders
    for(let key in Game.spawns){
        let spawn = Game.spawns[key]
        let builderCost = 0
        let builderCount = 0
        for(let i in Game.creeps){
            if(Game.creeps[i].memory.role === 'builder' && Game.creeps[i].room === spawn.room){
                builderCost += countBodyCost(Game.creeps[i], spawn)
                builderCount++
            }
        }

        // You don't really need more than 2 builders
        if(builderCount < (1 + (3 < spawn.room.controller.level)) && builderCost * 2 < spawn.room.energy[0] + spawn.room.energy[2]) {
            tryCreateCreep('builder', spawn.room.controller.level - 1, spawn)
        }
    }

    var rangers = _.filter(Game.creeps, (creep) => creep.memory.role == 'ranger');
    var maxRangers = roleRanger.countSites();

    // If we see an enemy in the room, reinforce attack force.
    if(0 < Game.spawns.Spawn1.room.find(FIND_HOSTILE_CREEPS).length)
        maxRangers++

    if(rangers.length < maxRangers) {
        tryCreateCreepInt('ranger', 0, [
            [RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE],
            [RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE]
        ])
    }

    for(let key in Game.spawns){
        var spawn = Game.spawns[key]
        var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader' && creep.room === spawn.room);
        var maxUpgraders = (spawn.room.controller.level + 1) / 2;
        if(Memory.stats && 0 < Memory.stats.restingCreeps)
            maxUpgraders += Memory.stats.restingCreeps;
        let stored = calcStoredEnergy(spawn.room)
        if(1600 < stored[0])
            maxUpgraders += 1;
        if(100000 < stored[0])
            maxUpgraders += 1;

        // console.log(upgraders.length + '/' + maxUpgraders)
        if(upgraders.length < maxUpgraders) {
            tryCreateCreep('upgrader',4,spawn)
        }
    }

    // Create transporters
    if(Game.spawns.Spawn2){
        let transporters = _.filter(Game.creeps, creep => creep.memory.role === 'transporter')
        if(transporters.length < 1){
            tryCreateCreepInt('transporter', 0, [
                [WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
                [WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
                [WORK,CARRY,CARRY,MOVE,MOVE],
            ], Game.spawns.Spawn2)
        }
    }

    var roles = {
        harvester: roleHarvester.run,
        builder: roleBuilder.run,
        attacker: roleAttacker.run,
        claimer: roleClaimer.run,
        ranger: roleRanger.run,
        transporter: roleTransporter.run,
        upgrader: roleUpgrader.run,
    }

    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        var run = roles[creep.memory.role]
        if(run)
            run(creep)
    }

    logStats()

    Memory.lastTick = Game.time
}
