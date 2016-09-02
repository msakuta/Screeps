var roleHarvester = require('role.harvester');
var roleAttacker = require('role.attacker');
var roleDigger = require('role.digger');
var roleClaimer = require('role.claimer');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRanger = require('role.ranger');
var roleInterceptor = require('role.interceptor');
var roleTransporter = require('role.transporter');
var stats = require('stats')

var bodyCosts = {
    [MOVE]: 50, [WORK]: 100, [CARRY]: 50, [ATTACK]: 80, [RANGED_ATTACK]: 150, [HEAL]: 250, [CLAIM]: 600, [TOUGH]: 10
}

function countBodyCost(creep){
    var ret = 0
    for(var i = 0; i < creep.body.length; i++)
        ret += bodyCosts[creep.body[i].type]
    return ret
}

function estimateBodyCost(body){
    return _.reduce(body, (accum, part) => accum + bodyCosts[part], 0)
}

/// Returns compact string (one character per part) representing the body
/// @returns {string} the string
function compactBodyString(body){
    var partsStr = ''
    for(var i = 0; i < body.length; i++)
        partsStr += body[i][0]
    return partsStr
}

function tryCreateCreepInt(role, priority, bodyCandidates, spawn){
    spawn = spawn || Game.spawns.Spawn1
    var maxCandidate = bodyCandidates.length - (priority || 0)
    if(spawn.memory.queue === undefined)
        spawn.memory.queue = []

    spawn.demands[role] = true

    // This is the spawning queue, managed for each spawn.
    // This is unlike usual queue in that it doesn't actually store a complete command
    // but an identifier (role name).  It's designed in this way because the conditions
    // and energy amount available change every tick, so if we had stored those information
    // into the queue, it would be not only redundant but could be outdated at the time of
    // actual creation.
    // Also note that if the situation changed so that particular role becomes
    // no longer necessary, we need to remove it from the queue, which is done
    // in the main loop.
    var queidx = spawn.memory.queue.indexOf(role)
    if(queidx < 0){
        // If the queue does not have the role name, push a new entry to the end
        spawn.memory.queue.push(role)
        queidx = 0
    }
    else if(0 < queidx) // It's not our turn yet
        return false
    if(spawn.issued)
        return

    var hasHarvester = 0 < _.filter(Game.creeps, c => c.room === spawn.room && c.memory.role === 'harvester').length
    for(var i = 0; i < maxCandidate; i++){
        var body = bodyCandidates[i];
        // If there's a harvester in the room and the cost of the newly created creep
        // is less than certain fraction of total energy capacity, be patient and
        // wait till the extensions are filled. However, if the candidate's
        // requirement is the maximum (i === 0), create no matter what.
        if(hasHarvester && i !== 0 && estimateBodyCost(bodyCandidates[i-1]) < spawn.room.energyCapacityAvailable && estimateBodyCost(body) < spawn.room.energyCapacityAvailable * 2 / 3){
            // Debug output
            // console.log('tryCreateCreep: ' + compactBodyString(body) + ': ' + estimateBodyCost(body) + '/' + spawn.room.energyAvailable + '/' + spawn.room.energyCapacityAvailable)
            return false
        }
        if(0 <= spawn.canCreateCreep(body))
            break;
    }
    if(i === maxCandidate){
        return false;
    }
    var newName = spawn.createCreep(body, undefined, {role: role});
    if(typeof newName === 'number' && newName < 0)
        return false
    // Signal other roles not to issue another createCreep command, because it would
    // overwrite this one's
    spawn.issued = true
    console.log('[' + spawn.name + '] Spawning new ' + role + ': ' + compactBodyString(body) + ', name: ' + newName);
    if(!Memory.spent)
        Memory.spent = {}
    Memory.spent[role] = (Memory.spent[role] || 0) + countBodyCost(Game.creeps[newName])
    // Pop the queue if successfully created
    if(queidx === 0)
        spawn.memory.queue.splice(0,1)
    return true
}

function tryCreateCreep(role, priority, spawn){
    return tryCreateCreepInt(role, priority, [
        [WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
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
    let containers = room.find(FIND_STRUCTURES, {filter: s => 0 <= [STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_TERMINAL].indexOf(s.structureType)})
    for(let j = 0; j < containers.length; j++){
        storedEnergy += containers[j].store.energy
        storedEnergyCapacity += containers[j].storeCapacity
    }
    return [storedEnergy, storedEnergyCapacity]
}

function logStats(){
    // Only record once in 100 ticks
    if(Game.time % 100 !== 0){
        // Strictly, we don't need to keep the value for every tick until accumulation.
        // We could just record total value and sum of those values and divide
        // at the end.
        appendHistory('tempcpu', Game.cpu.getUsed())
        return
    }
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

    appendHistory('timeHistory', Game.time)
    appendHistory('energyHistory', energy)
    appendHistory('storedEnergyHistory', storedEnergy)
    appendHistory('sourceHistory', source)
    appendHistory('cpuHistory', (function(){
        // Recaord average of CPU usage over last few ticks.
        // Once we record the value, the temporary array for last few ticks is
        // no longer necessary.
        if(Memory.tempcpu && Memory.tempcpu.length){
            // Truncate values to 2 decimal places to make the data more compact.
            // After all, the value doesn't have much precision.
            // Strangely it makes memory space efficient, and more importantly,
            // predictable, all because the values are serialized in JSON.
            let ret = Math.round(_.sum(Memory.tempcpu) / Memory.tempcpu.length * 100) / 100
            delete Memory.tempcpu
            return ret
        }
        else
            return Game.cpu.getUsed()
        })())
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
            var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {filter: c => !c.owner || !(c.owner.username in Memory.allies)});
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
                // Cache sink and source flags to use for harvesters
                links[0].sink = true
                for(let j = 1; j < links.length; j++){
                    // We need at least 100 space in order to transport to the sink
                    // because it would be so inefficient unless we do.
                    if(links[0].energy + Math.min(links[j].energy, 100) < links[0].energyCapacity)
                        links[j].transferEnergy(links[0])
                    links[j].source = true
                }
                //console.log('links sink: ' + links[0] + ', source: ' + links[1])
            }
            room.links = links
        }
    }

    // Process terminals and labs
    let terminals = []
    let srcTerminal = null
    let destTerminal = null
    for(let name in Game.rooms){
        let room = Game.rooms[name]
        if(!room.controller || !room.controller.my)
            continue
        let labs = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LAB})
        // Always labs[0] and labs[1] are inputs and labs[2] is the output.
        if(3 <= labs.length && 0 < labs[0].mineralAmount && 0 < labs[1].mineralAmount && labs[2].mineralAmount < labs[2].mineralCapacity){
            labs[2].runReaction(labs[0], labs[1])
        }

        // Determine source and destination terminals
        if(room.terminal && room.terminal.my){
            terminals.push(room.terminal)
            if(0 < labs.length){
                destTerminal = room.terminal
            }
            else if(0 < _.sum(room.terminal.store) - room.terminal.store.energy)
                srcTerminal = room.terminal
        }
    }

    // If both source and destination are prepared, send minerals
    if(srcTerminal && destTerminal){
        for(let resource in srcTerminal.store){
            // You can't send resources with amount less than 100
            if(resource === RESOURCE_ENERGY || srcTerminal.store[resource] < 100)
                continue
            let res = srcTerminal.send(resource, srcTerminal.store[resource], destTerminal.room.name)
            if(res < 0)
                console.log('terminal send failed! ' + resource + ' ' + srcTerminal.store[resource] + ' ' + res)
        }
    }


    // Reset spawn demands in case garbage remains in the VM
    for(let name in Game.spawns){
        let spawn = Game.spawns[name]
        spawn.demands = {}
        spawn.issued = false
    }

    // Level energy storage among rooms with terminals
    terminals.sort((a,b) => stats.totalEnergy(b.room)[2] < stats.totalEnergy(a.room)[2])
    if(2 <= terminals.length){
        let dest = terminals[0]
        let src = terminals[terminals.length-1]
        let amount = Math.min(dest.storeCapacity - _.sum(dest.store), (stats.totalEnergy(src.room)[2] - stats.totalEnergy(terminals[0].room)[2]) / 2)
        if(10000 < amount){
            let r = terminals[terminals.length-1].send(RESOURCE_ENERGY, amount, terminals[0].room.name)
            console.log(terminals[terminals.length-1].room + " sends energy to " + terminals[0].room +
                " for " + amount + " energy, with cost " + Game.market.calcTransactionCost(amount, src.room.name, dest.room.name) + " result: " + r)
        }
    }

    roleHarvester.sortDistance()

    var spawnCount = 0
    for(let key in Game.spawns)
        spawnCount++

    // Spawn harvesters
    var totalHarvesterCount = _.filter(Game.creeps, c => c.memory.role === 'harvester').length
    for(let key in Game.spawns){
        let spawn = Game.spawns[key]
        let harvesterCost = 0
        let harvesterCount = 0
        let diggerCount = 0
        for(let i in Game.creeps){
            if(Game.creeps[i].memory.role === 'harvester' && Game.creeps[i].room === spawn.room){
                harvesterCost += countBodyCost(Game.creeps[i])
                harvesterCount++
            }
            if(Game.creeps[i].memory.role === 'digger' && Game.creeps[i].room === spawn.room){
                diggerCount++
            }
        }

        let energy = stats.totalEnergy(spawn.room)
        spawn.room.energy = energy // cache stats for later use
        //console.log('harvesterCost: ' + harvesterCost + ', energy: ' + energy[0] + '/' + energy[2])

        let sourceCount = spawn.room.find(FIND_SOURCES).length;

        if((harvesterCount === 0 || harvesterCount + diggerCount < sourceCount + 1) && harvesterCost < 1000 && totalHarvesterCount < spawnCount * (sourceCount + 1)) {
            // If there is no harvester in a room, bring harvester creation to the front
            // of the queue because he would fill the spawn and extensions for others
            let harvesterIdx
            if(spawn.memory.queue && 0 < (harvesterIdx = spawn.memory.queue.indexOf('harvester'))){
                spawn.memory.queue.splice(harvesterIdx, 1)
                spawn.memory.queue.splice(0, 1, 'harvester')
            }

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
        for(let s in Game.spawns){
        if(tryCreateCreepInt('attacker', 0, [
                [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
                [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
            ], Game.spawns[s])
            )
            break
        }
    }

    var claimers = _.filter(Game.creeps, (creep) => creep.memory.role === 'claimer');
    // Create claimers as the same number of uncontrolled flags
    var maxClaimers = (() => {
        var ret = 0
        for(let i = 0; i < roleClaimer.flagNames.length; i++){
            let theflag = Game.flags[roleClaimer.flagNames[i]]
            if(theflag && (!theflag.room || !theflag.room.controller ||
                (!theflag.room.controller.reservation || theflag.room.controller.reservation.ticksToEnd < 4500)))
                ret++
        }
        return ret
    })()

    // Debug output
    //console.log('controllers: ' + controllers + ', gcl: ' + Game.gcl.level + ', maxClaimers: ' + maxClaimers + ', claimers: ' + claimers.length)

    if(claimers.length < maxClaimers) {
        for(let s in Game.spawns){
            if(tryCreateCreepInt('claimer', 0, [
            // Temporarily disable expensive (aggressive) claimer configuration,
            // since we won't attack controller for near future.
//            [CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,MOVE,MOVE],
                [CLAIM,CLAIM,MOVE,MOVE],
                [CLAIM,MOVE],
                ], Game.spawns[s]))
            break
        }
    }

    // Spawn builders
    var totalBuilderCount = _.filter(Game.creeps, c => c.memory.role === 'builder').length
    for(let key in Game.spawns){
        let spawn = Game.spawns[key]
        let builderCost = 0
        let builderCount = 0
        for(let i in Game.creeps){
            if(Game.creeps[i].memory.role === 'builder' && Game.creeps[i].room === spawn.room){
                builderCost += countBodyCost(Game.creeps[i])
                builderCount++
            }
        }

        // You don't really need more than 2 builders
        let creepsPerSpawn = (1 + (3 < spawn.room.controller.level))
        if(builderCount < creepsPerSpawn && builderCost * 2 < spawn.room.energy[0] + spawn.room.energy[2] && totalBuilderCount < spawnCount * creepsPerSpawn) {
            tryCreateCreep('builder', spawn.room.controller.level - 1, spawn)
        }
    }

    // Spawn diggers
    var totalDiggerCount = _.filter(Game.creeps, c => c.memory.role === 'digger').length
    for(let key in Game.spawns){
        let spawn = Game.spawns[key]

        if(totalDiggerCount < roleDigger.diggerCount()){
            if(tryCreateCreepInt('digger', 0, [
                [WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE,MOVE]
            ], spawn))
                totalDiggerCount++
        }
    }

    var rangers = _.filter(Game.creeps, (creep) => creep.memory.role == 'ranger');
    var maxRangers = roleRanger.countSites();

    // If we see an enemy in the room, reinforce attack force.
    if(0 < Game.spawns.Spawn1.room.find(FIND_HOSTILE_CREEPS).length)
        maxRangers++

    // Spawn rangers
    if(rangers.length < maxRangers) {
        for(let key in Game.spawns){
            var spawn = Game.spawns[key]
            if(tryCreateCreepInt('ranger', 0, [
                [TOUGH,TOUGH,TOUGH,TOUGH,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE],
                [TOUGH,TOUGH,TOUGH,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE],
                [RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE],
            ], spawn))
                break
        }
    }

    var interceptors = _.filter(Game.creeps, (creep) => creep.memory.role == 'interceptor');
    var maxInterceptors = !!roleInterceptor.findEnemy();

    // Spawn interceptors
    if(interceptors.length < maxInterceptors) {
        for(let key in Game.spawns){
            var spawn = Game.spawns[key]
            if(tryCreateCreepInt('interceptor', 0, [
                [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,ATTACK,RANGED_ATTACK,ATTACK,RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,HEAL],
                [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,ATTACK,RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,HEAL],
                [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,HEAL],
                [MOVE,MOVE,MOVE,RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,HEAL],
            ], spawn))
                break
        }
    }

    // Spawn upgraders
    var totalUpgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader').length
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
        if(upgraders.length < maxUpgraders && totalUpgraders < spawnCount * maxUpgraders * 1.5) {
            tryCreateCreep('upgrader',4,spawn)
        }
    }

    // Create transporters
    let transporters = _.filter(Game.creeps, creep => creep.memory.role === 'transporter').length
    for(let spawnName in Game.spawns){
        let spawn = Game.spawns[spawnName]
        if(transporters < 4){
            // Create body candidates with as much capacity as possible
            let transporterBodyCandidates = []
            for(let i = 13; 0 <= i; i--){
                let body = [WORK,CARRY,MOVE]
                for(let j = 0; j < i; j++){
                    body.push(CARRY,CARRY,MOVE)
                }
                transporterBodyCandidates.push(body)
//                console.log('body: ' + i + ': ' + body)
            }
            if(tryCreateCreepInt('transporter', 0, transporterBodyCandidates, spawn))
                transporters++
        }
    }

    // Clear queue entries which has no demand in this tick, because unless we do,
    // an outdated queue entry could stay forever, blocking other entries.
    // If the demand emerges again after such a tick, it will be pushed to the
    // end of the queue, which means it needs to wait from the start.
    for(let name in Game.spawns){
        let spawn = Game.spawns[name]
        if(spawn && !spawn.memory.queue)
            continue
        //console.log(spawn + ' queue: ' + spawn.memory.queue.length + ' demands: ' + _.sum(spawn.demands))
        for(let i = 0; i < spawn.memory.queue.length;){
            if(!(spawn.memory.queue[i] in spawn.demands))
                spawn.memory.queue.splice(i, 1)
            else {
                i++
            }
        }
    }

    var roles = {
        harvester: roleHarvester.run,
        builder: roleBuilder.run,
        digger: roleDigger.run,
        attacker: roleAttacker.run,
        claimer: roleClaimer.run,
        ranger: roleRanger.run,
        interceptor: roleInterceptor.run,
        transporter: roleTransporter.run,
        upgrader: roleUpgrader.run,
    }

    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        var run = roles[creep.memory.role]
        if(run){
            try{
                run(creep)
            }
            catch(e){
                console.log("ERROR: Exception on " + creep.name + ": ", e.stack)
            }
        }
    }

    for(let r in Game.rooms){
        let room = Game.rooms[r]
        let sources = room.find(FIND_SOURCES)
        for(let s in sources){
            let source = sources[s]
            if(source.harvesters)
                console.log(room.name + ': ' + source.pos.x + ', ' + source.pos.y + ': ' + source.harvesters)
        }
    }

    logStats()

    Memory.lastTick = Game.time
}
