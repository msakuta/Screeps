''' A script to download and save statistics information from a Screeps account '''
from __future__ import with_statement
import json
try:
	from screepsapi import *
except:
	print('ERROR you need screepsapi installed on your computer, see https://github.com/screepers/python-screeps')
	exit(-10)

try:
	with open('credentials.json') as fcred:
		obj = json.load(fcred)
		user = obj['user']
		password = obj['password']
except IOError as e:
	print('ERROR opening credentials.json, make sure you\'ve created the file with \'user\' and \'password\' keys.\n' + str(type(e)))
	exit(-1)
except Exception as e:
	print('ERROR parsing credentials.json: ' + str(type(e)))
	exit(-2)


try:
	api = API(user, password)
except:
	print('ERROR opening Screeps api: probably your credentials information is wrong.')
	exit(-3)

columns = ['timeHistory', 'energyHistory', 'storedEnergyHistory', 'sourceHistory', 'cpuHistory']
columnResults = []
for col in columns:
	res = api.memory(col)
	if not res['ok']:
		exit()
	columnResults.append(res['data'])

f = open('stats.txt', 'w')

header = ''

for col in columns:
	header += col + '\t'

f.write(header + '\n')

for i in range(len(columnResults[0])):
	s = ''
	for c in range(len(columns)):
		s += str(columnResults[c][i]) + '\t'
	print(s)
	f.write(s + '\n')

f.close()
